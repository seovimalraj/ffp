"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useIsMobile } from "@/hooks/use-mobile";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BellIcon } from "./icons";

const notificationList = [
  {
    image: "/images/user/user-15.png",
    title: "Piter Joined the Team!",
    subTitle: "Congratulate him",
  },
  {
    image: "/images/user/user-03.png",
    title: "New message",
    subTitle: "Devid sent a new message",
  },
  {
    image: "/images/user/user-26.png",
    title: "New Payment received",
    subTitle: "Check your earnings",
  },
  {
    image: "/images/user/user-28.png",
    title: "Jolly completed tasks",
    subTitle: "Assign new task",
  },
  {
    image: "/images/user/user-27.png",
    title: "New order received",
    subTitle: "Check order details",
  },
];

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(notificationList);
  const isMobile = useIsMobile();

  const handleRemoveNotification = (index: number) => {
    setNotifications(notifications.filter((_, i) => i !== index));
  };

  return (
    <Dropdown isOpen={isOpen} setIsOpen={setIsOpen}>
      <DropdownTrigger className="relative rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
        <span className="sr-only">Notifications</span>
        <BellIcon className="h-6 w-6" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {notifications.length}
          </span>
        )}
      </DropdownTrigger>

      <DropdownContent align={isMobile ? "start" : "end"} className="w-80 p-0">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-dark dark:text-white">
            Notifications
          </h3>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No notifications
            </div>
          ) : (
            notifications.map((notification, index) => (
              <div
                key={index}
                className="flex items-center gap-3 border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-700"
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full">
                  <Image
                    src={notification.image}
                    alt={notification.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-dark dark:text-white">
                    {notification.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {notification.subTitle}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveNotification(index)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <Link
              href="/notifications"
              className="block text-center text-primary hover:underline"
            >
              View all notifications
            </Link>
          </div>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
