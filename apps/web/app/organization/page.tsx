'use client';

import React from 'react';
import DefaultLayout from '@/components/Layouts/DefaultLayout';

export default function OrganizationPage() {
  return (
    <DefaultLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization</h1>
          <p className="mt-2 text-gray-600">Manage your organization settings and team members.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Organization Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Organization Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <p className="mt-1 text-sm text-gray-900">Your Organization Name</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Industry</label>
                <p className="mt-1 text-sm text-gray-900">Manufacturing</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Size</label>
                <p className="mt-1 text-sm text-gray-900">50-100 employees</p>
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Members</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">John Doe</p>
                  <p className="text-sm text-gray-500">Admin</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultLayout>
  );
}
