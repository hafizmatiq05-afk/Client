import { json, type LoaderFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Frame,
  Navigation,
  TopBar,
} from "@shopify/polaris";
import {
  HomeIcon,
  SettingsIcon,
  QuestionMarkIcon,
} from "@shopify/polaris-icons";
import enTranslations from "@shopify/polaris/locales/en.json";
import { authenticate } from "~/shopify.server";
import { initializeScheduler } from "~/jobs/scheduler.server";

interface ContextData {
  shop: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  // Move scheduler initialization here from root.tsx
  if (admin) {
    try {
      await initializeScheduler(admin);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Failed to initialize scheduler:", errorMsg);
    }
  }

  return json({ shop });
};

export default function App() {
  const { shop } = useLoaderData<ContextData>();

  const navigationItems = [
    {
      url: "/app",
      label: "Dashboard",
      icon: HomeIcon,
    },
    {
      url: "/app/settings",
      label: "Settings",
      icon: SettingsIcon,
    },
    {
      url: "/app/help",
      label: "Help & Documentation",
      icon: QuestionMarkIcon,
    },
  ];

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      userMenu={<TopBar.UserMenu actions={[{ items: [{ content: "Log out" }] }]} />}
    />
  );

  const navigationMarkup = (
    <Navigation location="/app">
      {navigationItems.map((item) => (
        <Navigation.Item
          key={item.url}
          url={item.url}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </Navigation>
  );

  return (
    <AppProvider i18n={enTranslations}>
      <Frame topBar={topBarMarkup} navigation={navigationMarkup}>
        <Outlet context={{ shop }} />
      </Frame>
    </AppProvider>
  );
}
