"""Tests for the Swagger / OpenAPI documentation.

Documented examples are validated against the real Pydantic models, so an
example cannot silently drift away from the schema it is meant to illustrate.
"""

from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import machining as machining_router
from app.machining.openapi import (
    AMBIGUOUS_EXAMPLE,
    ERROR_EXAMPLES,
    SUCCESS_EXAMPLE,
    error_responses,
    success_responses,
)
from app.machining.schemas import MachiningErrorResponse

PATH = "/api/v1/cad/analyze-machining"


@pytest.fixture(scope="module")
def app() -> FastAPI:
    application = FastAPI(title="CAD Service", version="1.0.0")
    application.include_router(machining_router.router, prefix="/api/v1/cad")
    return application


@pytest.fixture(scope="module")
def schema(app) -> dict:
    return app.openapi()


@pytest.fixture(scope="module")
def operation(schema) -> dict:
    return schema["paths"][PATH]["post"]


class TestSchemaIsServed:
    def test_openapi_json_is_available(self, app):
        response = TestClient(app).get("/openapi.json")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/json")

    def test_swagger_ui_is_available(self, app):
        response = TestClient(app).get("/docs")
        assert response.status_code == 200
        assert "swagger-ui" in response.text.lower()

    def test_redoc_is_available(self, app):
        assert TestClient(app).get("/redoc").status_code == 200

    def test_schema_declares_openapi_3(self, schema):
        assert schema["openapi"].startswith("3.")


class TestEndpointDocumentation:
    def test_the_endpoint_is_documented(self, schema):
        assert PATH in schema["paths"]
        assert f"{PATH}/capabilities" in schema["paths"]

    def test_summary_and_description_are_present(self, operation):
        assert operation["summary"]
        assert len(operation["description"]) > 200

    def test_the_scope_boundary_is_stated_in_the_docs(self, operation):
        text = operation["description"].lower()
        assert "what geometry exists" in text
        assert "price" in text and "no llm" in text

    def test_request_body_is_multipart(self, operation):
        assert "multipart/form-data" in operation["requestBody"]["content"]

    def test_every_form_field_is_documented(self, schema, operation):
        body = operation["requestBody"]["content"]["multipart/form-data"]["schema"]
        ref = body.get("$ref", "")
        model = schema["components"]["schemas"][ref.rsplit("/", 1)[-1]]
        properties = model["properties"]
        for field in (
            "file",
            "unit_system",
            "include_face_details",
            "include_feature_details",
            "include_debug_geometry",
        ):
            assert field in properties, f"{field} missing from the request schema"
            assert properties[field].get("description"), f"{field} has no description"

    def test_all_error_codes_are_documented(self, operation):
        assert set(operation["responses"]) >= {
            "200",
            "400",
            "413",
            "415",
            "422",
            "503",
        }

    def test_success_response_references_the_model(self, operation):
        schema_ref = operation["responses"]["200"]["content"]["application/json"]["schema"]
        assert "MachiningAnalysisResponse" in json.dumps(schema_ref)

    def test_capabilities_endpoint_is_documented(self, schema):
        operation = schema["paths"][f"{PATH}/capabilities"]["get"]
        assert operation["summary"]
        assert operation["description"]


class TestExamples:
    def test_success_response_carries_examples(self, operation):
        examples = operation["responses"]["200"]["content"]["application/json"]["examples"]
        assert set(examples) == {"typical", "ambiguous"}

    @pytest.mark.parametrize("status", ["400", "413", "415", "422", "503"])
    def test_every_error_response_carries_an_example(self, operation, status):
        content = operation["responses"][status]["content"]["application/json"]
        assert content["examples"], f"{status} has no example"

    def test_the_typical_example_validates_against_the_response_model(self):
        # Guards against the documented example drifting from the schema.
        from app.machining.schemas import MachiningAnalysisResponse

        MachiningAnalysisResponse.model_validate(SUCCESS_EXAMPLE)

    def test_every_error_example_validates_against_the_error_model(self):
        for status, examples in ERROR_EXAMPLES.items():
            for name, example in examples.items():
                MachiningErrorResponse.model_validate(example["value"]), (status, name)

    def test_error_examples_are_all_marked_unsuccessful(self):
        for examples in ERROR_EXAMPLES.values():
            for example in examples.values():
                assert example["value"]["success"] is False
                assert example["value"]["errors"]

    def test_the_ambiguous_example_demonstrates_a_reason(self):
        features = AMBIGUOUS_EXAMPLE["value"]["features"]
        ambiguous = features["internal_cylindrical_features"] + features["threads"]
        assert ambiguous
        for feature in ambiguous:
            assert feature["status"] == "ambiguous"
            assert feature["reason"]

    def test_the_thread_example_never_invents_a_designation(self):
        thread = AMBIGUOUS_EXAMPLE["value"]["features"]["threads"][0]
        assert thread["designation"] is None
        assert "not inferred from diameter" in thread["reason"]

    def test_no_example_contains_a_pricing_field(self):
        blob = json.dumps([SUCCESS_EXAMPLE, AMBIGUOUS_EXAMPLE, ERROR_EXAMPLES])
        payload = json.loads(blob)

        def keys(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    yield key.lower()
                    yield from keys(value)
            elif isinstance(node, list):
                for item in node:
                    yield from keys(item)

        forbidden = ("price", "cost", "hourly", "quote", "currency", "rate")
        assert not [k for k in keys(payload) if any(w in k for w in forbidden)]

    def test_response_helpers_are_well_formed(self):
        combined = {**success_responses(), **error_responses()}
        assert set(combined) == {200, 400, 413, 415, 422, 503}
        for status, spec in combined.items():
            assert spec["description"], f"{status} has no description"


class TestApplicationLevelDocs:
    """Tag metadata and API description on the real application."""

    @pytest.fixture(scope="class")
    @classmethod
    def full_schema(cls):
        from app.main import app as real_app

        return real_app.openapi()

    def test_tags_carry_descriptions(self, full_schema):
        tags = {tag["name"]: tag for tag in full_schema["tags"]}
        assert "machining-analysis" in tags
        for tag in tags.values():
            assert tag.get("description"), f"tag {tag['name']} has no description"

    def test_the_machining_tag_states_the_scope_boundary(self, full_schema):
        tag = next(
            t for t in full_schema["tags"] if t["name"] == "machining-analysis"
        )
        description = tag["description"].lower()
        assert "does **not** estimate cost" in description
        assert "no llm" in description

    def test_api_description_documents_units_and_kernel(self, full_schema):
        description = full_schema["info"]["description"].lower()
        assert "millimetre" in description
        assert "opencascade" in description

    def test_servers_are_declared(self, full_schema):
        assert full_schema["servers"]
        assert all("url" in server for server in full_schema["servers"])

    def test_contact_avoids_the_optional_email_validator_dependency(self, full_schema):
        contact = full_schema["info"].get("contact", {})
        assert "email" not in contact
