import { createClient } from "@/lib/supabase/server";

export default async function ManualReviewPage() {
  const supabase = await createClient();

  // Get all machines with their TBD triggers
  const { data: machines } = await supabase
    .from("machines")
    .select(
      `
      *,
      tbd_triggers(*)
    `,
    )
    .order("name");

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">
            Manual Review Rules
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure when quotes should be flagged for manual review
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {machines?.map((machine) => {
          const trigger = machine.tbd_triggers?.[0];
          return (
            <div
              key={machine.id}
              className="overflow-hidden bg-white shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg"
            >
              <div className="px-4 py-5 sm:px-6 bg-gray-50">
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                  {machine.name}
                  <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                    {machine.process_type}
                  </span>
                </h3>
              </div>

              <div className="p-6">
                <form
                  action="/api/tbd-triggers"
                  method="POST"
                  className="space-y-8"
                >
                  <input type="hidden" name="machine_id" value={machine.id} />
                  <input type="hidden" name="trigger_id" value={trigger?.id} />

                  <div>
                    <div className="space-y-6">
                      <div>
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            name="manual_review_on_unlisted_feature"
                            defaultChecked={
                              trigger?.manual_review_on_unlisted_feature
                            }
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="ml-2 text-sm text-gray-900">
                            Manual review for unlisted features
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Quantity Range for Review
                          </label>
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500">
                                Min
                              </label>
                              <input
                                type="number"
                                name="min_qty"
                                defaultValue={trigger?.min_qty_for_review}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">
                                Max
                              </label>
                              <input
                                type="number"
                                name="max_qty"
                                defaultValue={trigger?.max_qty_for_review}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Cost Range for Review ($)
                          </label>
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500">
                                Min
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                name="min_cost"
                                defaultValue={trigger?.min_cost_for_review}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">
                                Max
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                name="max_cost"
                                defaultValue={trigger?.max_cost_for_review}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Dimension Range for Review (mm)
                          </label>
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-500">
                                Min
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                name="min_dimension"
                                defaultValue={trigger?.min_dimension_for_review}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500">
                                Max
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                name="max_dimension"
                                defaultValue={trigger?.max_dimension_for_review}
                                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="ml-3 inline-flex justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
