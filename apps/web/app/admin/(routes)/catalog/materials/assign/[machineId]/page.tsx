import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function AssignMaterialsPage({
  params: { machineId },
}: {
  params: { machineId: string };
}) {
  const supabase = await createClient();

  // Get machine details
  const { data: machine } = await supabase
    .from("machines")
    .select("*")
    .eq("id", machineId)
    .single();

  if (!machine) {
    notFound();
  }

  // Get all materials and their mapping status for this machine
  const { data: materials } = await supabase
    .from("materials")
    .select(
      `
      *,
      machine_materials!inner(*)
    `,
    )
    .order("name");

  return (
    <div className="p-6 space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Assign Materials</h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure materials and their properties for {machine.name}
          </p>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form
            action="/api/machine-materials"
            method="POST"
            className="space-y-8"
          >
            <input type="hidden" name="machine_id" value={machineId} />

            <div>
              <h3 className="text-base font-semibold leading-7 text-gray-900">
                Material Selection
              </h3>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Choose materials that can be processed on this machine and set
                their parameters.
              </p>

              <div className="mt-6 space-y-8">
                {materials?.map((material) => {
                  const mapping = material.machine_materials?.find(
                    (m: { machine_id: string }) => m.machine_id === machineId,
                  );
                  return (
                    <div
                      key={material.id}
                      className="border-b border-gray-200 pb-6"
                    >
                      <div className="flex items-start">
                        <div className="flex h-6 items-center">
                          <input
                            type="checkbox"
                            name={`materials[${material.id}].enabled`}
                            defaultChecked={!!mapping}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </div>
                        <div className="ml-3">
                          <label className="font-medium text-gray-900">
                            {material.name}
                          </label>
                          <p className="text-sm text-gray-500">
                            {material.category} · {material.density} g/cm³
                          </p>
                        </div>
                      </div>

                      <div className="ml-7 mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Min Wall Thickness (mm)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name={`materials[${material.id}].min_wall`}
                            defaultValue={mapping?.min_wall_thickness}
                            className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Max Wall Thickness (mm)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name={`materials[${material.id}].max_wall`}
                            defaultValue={mapping?.max_wall_thickness}
                            className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Cost Multiplier
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name={`materials[${material.id}].cost_multiplier`}
                            defaultValue={mapping?.cost_multiplier ?? 1}
                            className="mt-1 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex justify-end gap-x-3">
                <button
                  type="button"
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                >
                  Save Assignments
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
