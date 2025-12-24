import { createClient } from "@/lib/supabase/server";
import {
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/20/solid";

export default async function ProfilesPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("pricing_profiles")
    .select(
      `
      *,
      machine_profile_links(
        machine:machines(
          name
        )
      )
    `,
    )
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Pricing Profiles</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage pricing profiles and publish updates to the quoting engine
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary/90"
          >
            <PlusIcon
              className="-ml-0.5 mr-1.5 h-5 w-5 inline-block"
              aria-hidden="true"
            />
            New Profile
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Machines
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Effective Range
                    </th>
                    <th
                      scope="col"
                      className="relative py-3.5 pl-3 pr-4 sm:pr-6"
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {profiles?.map((profile) => (
                    <tr key={profile.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {profile.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            profile.status === "published"
                              ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                              : "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20"
                          }`}
                        >
                          {profile.status === "published" ? (
                            <CheckCircleIcon
                              className="-ml-0.5 mr-1.5 h-4 w-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <ClockIcon
                              className="-ml-0.5 mr-1.5 h-4 w-4"
                              aria-hidden="true"
                            />
                          )}
                          {profile.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {profile.machine_profile_links?.length ?? 0} machines
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {profile.effective_from && profile.effective_to ? (
                          <>
                            {new Date(
                              profile.effective_from,
                            ).toLocaleDateString()}{" "}
                            -
                            {new Date(
                              profile.effective_to,
                            ).toLocaleDateString()}
                          </>
                        ) : (
                          "Not set"
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex justify-end gap-x-3">
                          <button
                            type="button"
                            className="text-primary hover:text-primary/80"
                          >
                            Edit
                          </button>
                          {profile.status === "draft" && (
                            <button
                              type="button"
                              className="text-green-600 hover:text-green-700"
                            >
                              Publish
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
