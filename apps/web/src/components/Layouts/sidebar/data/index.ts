import * as Icons from "./icons";

export const NAV_DATA = [
  {
    label: "MAIN MENU",
    items: [
      {
        title: "Dashboard",
        icon: Icons.HomeIcon,
        items: [
          {
            title: "Overview",
            url: "/",
          },
        ],
      },
      {
        title: "Quotes",
        url: "/quotes",
        icon: Icons.Table,
        items: [],
      },
      {
        title: "Orders",
        url: "/orders",
        icon: Icons.User,
        items: [],
      },
      {
        title: "Customers",
        icon: Icons.User,
        items: [
          {
            title: "All Customers",
            url: "/customers",
          },
        ],
      },
      {
        title: "Analytics",
        url: "/analytics",
        icon: Icons.PieChart,
        items: [],
      },
    ],
  },
  {
    label: "OTHERS",
    items: [
      {
        title: "Settings",
        icon: Icons.Authentication,
        items: [
          {
            title: "General",
            url: "/settings",
          },
        ],
      },
      {
        title: "Support",
        url: "/support",
        icon: Icons.FourCircle,
        items: [],
      },
    ],
  },
];
