"""Assembly vs multi-body-part routing.

Counting solid bodies cannot tell a real assembly from a single part that
happens to contain several bodies: both arrive from OneShape as one compound of
N solids. Only the STEP product structure distinguishes them, so these tests
pin the routing rules that decide whether a file goes to manual quoting.

The rules are exercised through ``decide_assembly``, which takes counts instead
of a shape and therefore needs no CAD kernel.
"""

from app.loaders.step_loader import (
    AssemblyInfo,
    ProductStructureInfo,
    decide_assembly,
)


def single_product(name: str = "PART") -> ProductStructureInfo:
    """One product, no instanced components — a standalone part."""
    return ProductStructureInfo(
        available=True,
        root_count=1,
        assembly_root_count=0,
        component_count=0,
        root_names=[name],
    )


def assembly_product(components: int, name: str = "ASSY") -> ProductStructureInfo:
    return ProductStructureInfo(
        available=True,
        root_count=1,
        assembly_root_count=1,
        component_count=components,
        root_names=[name],
    )


class TestProductStructureWins:
    def test_multi_body_part_is_not_an_assembly(self):
        """The RABITAT LUNCH BOX case: 16 bodies, one product, zero components.

        A multibody SolidWorks part. Routing it to manual quoting skips all
        geometric analysis, so the bodies must not be mistaken for components.
        """
        info = decide_assembly(
            solid_count=16,
            compound_count=1,
            shell_count=16,
            product_structure=single_product("RABITAT LUNCH BOX_05122025"),
        )

        assert info.is_assembly is False
        assert info.is_multi_body_part is True
        assert info.detection_source == "product_structure"
        assert info.solid_count == 16
        assert "RABITAT LUNCH BOX_05122025" in info.reason

    def test_real_assembly_is_still_detected(self):
        info = decide_assembly(
            solid_count=18,
            compound_count=1,
            shell_count=18,
            product_structure=assembly_product(components=27, name="as1"),
        )

        assert info.is_assembly is True
        assert info.is_multi_body_part is False
        assert info.detection_source == "product_structure"
        assert "27 components" in info.reason

    def test_assembly_whose_geometry_did_not_resolve(self):
        """Components but no bodies — body counting would call this one part.

        Real files do this (MAINBODY.stp in the CAx-IF set): the product tree
        lists components while OneShape yields no solids at all.
        """
        info = decide_assembly(
            solid_count=0,
            compound_count=0,
            shell_count=0,
            product_structure=assembly_product(components=2, name="MAINBODY"),
        )

        assert info.is_assembly is True
        assert info.detection_source == "product_structure"

    def test_multiple_roots_count_as_an_assembly(self):
        structure = ProductStructureInfo(
            available=True,
            root_count=3,
            assembly_root_count=0,
            component_count=0,
            root_names=["A", "B", "C"],
        )
        info = decide_assembly(
            solid_count=3, compound_count=1, shell_count=3,
            product_structure=structure,
        )

        assert info.is_assembly is True
        assert info.detection_source == "product_structure"

    def test_plain_single_part(self):
        info = decide_assembly(
            solid_count=1,
            compound_count=0,
            shell_count=1,
            product_structure=single_product("Motor Mount Part"),
        )

        assert info.is_assembly is False
        assert info.is_multi_body_part is False
        assert "Motor Mount Part" in info.reason


class TestTopologyFallback:
    """Used for IGES, which has no product structure, and unreadable trees."""

    def test_no_structure_falls_back_to_body_count(self):
        info = decide_assembly(
            solid_count=16, compound_count=1, shell_count=16,
            product_structure=None,
        )

        assert info.is_assembly is True
        assert info.detection_source == "topology"
        assert "16 solid bodies" in info.reason

    def test_unavailable_structure_falls_back(self):
        info = decide_assembly(
            solid_count=4, compound_count=1, shell_count=4,
            product_structure=ProductStructureInfo(
                available=False, note="STEPCAF read failed"
            ),
        )

        assert info.is_assembly is True
        assert info.detection_source == "topology"

    def test_readable_but_inconclusive_structure_falls_back(self):
        """Zero free shapes says nothing either way, so don't trust it."""
        info = decide_assembly(
            solid_count=5, compound_count=1, shell_count=5,
            product_structure=ProductStructureInfo(
                available=True, root_count=0,
                assembly_root_count=0, component_count=0,
            ),
        )

        assert info.is_assembly is True
        assert info.detection_source == "topology"

    def test_shell_only_assembly(self):
        info = decide_assembly(
            solid_count=0, compound_count=0, shell_count=5,
            product_structure=None,
        )

        assert info.is_assembly is True
        assert "shell bodies" in info.reason

    def test_single_body_is_a_part(self):
        info = decide_assembly(
            solid_count=1, compound_count=0, shell_count=1,
            product_structure=None,
        )

        assert info.is_assembly is False
        assert info.is_multi_body_part is False


class TestDefaults:
    def test_assembly_info_defaults_keep_existing_callers_working(self):
        info = AssemblyInfo(
            is_assembly=False, solid_count=1, compound_count=0,
            shell_count=0, reason="x",
        )

        assert info.is_multi_body_part is False
        assert info.detection_source == "topology"
