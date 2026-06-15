import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Tabs,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  Button,
  EmptyState,
  Box,
  InlineGrid,
  ButtonGroup,
} from "@shopify/polaris";
import { PlayIcon } from "@shopify/polaris-icons";
import { useState } from "react";
import db from "~/db.server";
import { authenticate } from "~/shopify.server";
import { fetchProducts } from "~/services/shopify.server";
import { getPricingSummary, runPricingCycle } from "~/services/pricing.server";

interface LoaderData {
  summary: {
    productsMonitored: number;
    updatedLastCycle: number;
    avgPriceChange: string;
  };
  priceHistory: Array<{
    id: number;
    productTitle: string;
    oldPrice: number;
    newPrice: number;
    percentChange: string;
    inventoryAtChange: number;
    aiReason: string;
    createdAt: string;
  }>;
}

export const loader: LoaderFunction = async ({
  request,
}): Promise<LoaderData> => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Get summary statistics
    const summary = await getPricingSummary(shop);

    // Get all products to count monitored ones
    const allVariants = await fetchProducts(admin);

    // Get pricing settings for threshold
    const settings = await db.pricingSettings.findUnique({
      where: { shop },
    });

    const threshold = settings?.inventoryThreshold || 50;
    const monitored = allVariants.filter(
      (v) => v.inventoryQuantity <= threshold
    ).length;

    // Get recent price history (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const history = await db.priceHistory.findMany({
      where: {
        shop,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const priceHistory = history.map((record) => {
      const percentChange = (
        ((record.newPrice - record.oldPrice) / record.oldPrice) *
        100
      ).toFixed(2);
      return {
        id: record.id,
        productTitle: record.productTitle,
        oldPrice: record.oldPrice,
        newPrice: record.newPrice,
        percentChange,
        inventoryAtChange: record.inventoryAtChange,
        aiReason: record.aiReason,
        createdAt: record.createdAt.toISOString(),
      };
    });

    return json({
      summary: {
        productsMonitored: monitored,
        updatedLastCycle: summary.updatedLastCycle,
        avgPriceChange: summary.avgPriceChange.toFixed(2),
      },
      priceHistory,
    });
  } catch (error) {
    console.error("Dashboard loader error:", error);
    return json({
      summary: {
        productsMonitored: 0,
        updatedLastCycle: 0,
        avgPriceChange: "0.00",
      },
      priceHistory: [],
    });
  }
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    console.log(`Manual pricing cycle triggered for shop: ${shop}`);
    const results = await runPricingCycle(admin, shop);

    const updated = results.filter(
      (r) => r.status === "updated" || r.status === "capped_at_max"
    ).length;

    return json({
      success: true,
      message: `Pricing cycle complete! ${updated} products updated.`,
      results,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Manual pricing cycle error for ${shop}:`, errorMsg);
    return json(
      { error: `Failed to run pricing cycle: ${errorMsg}` },
      { status: 500 }
    );
  }
};

export default function DashboardPage() {
  const { summary, priceHistory } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const [selectedTab, setSelectedTab] = useState(0);

  const isRunning = fetcher.state === "submitting";

  const tabs = [
    {
      id: "summary",
      content: "Summary",
      badge: "Live",
    },
    {
      id: "history",
      content: "Price History",
      badge: String(priceHistory.length),
    },
  ];

  const handleManualRun = () => {
    fetcher.submit({ action: "runPricingCycle" }, { method: "POST" });
  };

  return (
    <Page title="AI Pricing Dashboard">
      <Layout>
        {/* Manual Run Button */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <ButtonGroup>
                <Button
                  variant="primary"
                  icon={PlayIcon}
                  onClick={handleManualRun}
                  loading={isRunning}
                  disabled={isRunning}
                >
                  {isRunning
                    ? "Running Pricing Check..."
                    : "Run Pricing Check Now"}
                </Button>
              </ButtonGroup>
              <Box paddingBlockStart="400">
                <Text as="p" variant="bodySm" tone="subdued">
                  Click to manually trigger a pricing cycle. Automatic cycles run
                  according to your schedule settings.
                </Text>
              </Box>
            </Box>
          </Card>
        </Layout.Section>

        {/* Summary Cards */}
        {selectedTab === 0 && (
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
              <Card>
                <Box padding="400">
                  <Text as="h3" variant="headingMd">
                    Monitored Products
                  </Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {summary.productsMonitored}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Products below inventory threshold
                  </Text>
                </Box>
              </Card>

              <Card>
                <Box padding="400">
                  <Text as="h3" variant="headingMd">
                    Updated (Last 24h)
                  </Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    {summary.updatedLastCycle}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Prices adjusted by AI
                  </Text>
                </Box>
              </Card>

              <Card>
                <Box padding="400">
                  <Text as="h3" variant="headingMd">
                    Avg Price Change
                  </Text>
                  <Text as="p" variant="heading2xl" fontWeight="bold">
                    +{summary.avgPriceChange}%
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Average increase across updates
                  </Text>
                </Box>
              </Card>
            </InlineGrid>
          </Layout.Section>
        )}

        {/* Tabs */}
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              {/* Summary Tab */}
              {selectedTab === 0 && (
                <Box padding="400">
                  <Text as="p" variant="bodyMd" tone="subdued">
                    📊 Dashboard summary showing real-time monitoring metrics.
                    Products are monitored when their inventory falls below your
                    threshold setting.
                  </Text>
                </Box>
              )}

              {/* Price History Tab */}
              {selectedTab === 1 && (
                <Box padding="400">
                  {priceHistory.length === 0 ? (
                    <EmptyState
                      heading="No price changes yet"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/t/2/assets/empty-state.svg"
                    >
                      <p>
                        Once AI pricing cycles run, you'll see a history of all
                        price adjustments here.
                      </p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      resourceName={{
                        singular: "price change",
                        plural: "price changes",
                      }}
                      items={priceHistory}
                      renderItem={(item) => (
                        <ResourceItem
                          id={String(item.id)}
                          media={
                            <Badge tone="success">
                              +{item.percentChange}%
                            </Badge>
                          }
                        >
                          <Box paddingBlockStart="200">
                            <Text
                              as="h3"
                              variant="headingMd"
                              fontWeight="bold"
                            >
                              {item.productTitle}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              ${item.oldPrice.toFixed(2)} → $
                              {item.newPrice.toFixed(2)}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              📦 Inventory: {item.inventoryAtChange} units
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              💡 {item.aiReason}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              🕐 {new Date(item.createdAt).toLocaleString()}
                            </Text>
                          </Box>
                        </ResourceItem>
                      )}
                    />
                  )}
                </Box>
              )}
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
