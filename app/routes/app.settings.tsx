import { json, type ActionFunction, type LoaderFunction } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Text,
  Button,
  Banner,
  Box,
} from "@shopify/polaris";
import { useState } from "react";
import db from "~/db.server";
import { authenticate } from "~/shopify.server";
import { registerCronJob } from "~/jobs/scheduler.server";

export const loader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let settings = await db.pricingSettings.findUnique({
    where: { shop },
  });

  if (!settings) {
    settings = await db.pricingSettings.create({
      data: {
        shop,
        inventoryThreshold: 50,
        maxPriceIncreasePercent: 50,
        reviewFrequency: "daily",
      },
    });
  }

  return json({
    inventoryThreshold: settings.inventoryThreshold,
    maxPriceIncreasePercent: settings.maxPriceIncreasePercent,
    reviewFrequency: settings.reviewFrequency,
    aiBehaviorPrompt: settings.aiBehaviorPrompt || "",
  });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const inventoryThreshold = parseInt(
    formData.get("inventoryThreshold") as string,
    10
  );
  const maxPriceIncreasePercent = parseFloat(
    formData.get("maxPriceIncreasePercent") as string
  );
  const reviewFrequency = formData.get("reviewFrequency") as string;
  const aiBehaviorPrompt = (formData.get("aiBehaviorPrompt") as string) || null;

  // Validate inputs
  if (isNaN(inventoryThreshold) || inventoryThreshold < 0) {
    return json(
      { error: "Inventory Threshold must be a non-negative number" },
      { status: 400 }
    );
  }

  if (isNaN(maxPriceIncreasePercent) || maxPriceIncreasePercent < 0) {
    return json(
      { error: "Max Price Increase must be a non-negative percentage" },
      { status: 400 }
    );
  }

  const validFrequencies = ["hourly", "daily", "weekly", "monthly"];
  if (!validFrequencies.includes(reviewFrequency)) {
    return json(
      { error: "Invalid review frequency" },
      { status: 400 }
    );
  }

  try {
    // Update or create settings
    const updated = await db.pricingSettings.upsert({
      where: { shop },
      update: {
        inventoryThreshold,
        maxPriceIncreasePercent,
        reviewFrequency,
        aiBehaviorPrompt,
      },
      create: {
        shop,
        inventoryThreshold,
        maxPriceIncreasePercent,
        reviewFrequency,
        aiBehaviorPrompt,
      },
    });

    // Re-register cron job with new frequency
    if (admin) {
      registerCronJob(shop, admin, reviewFrequency);
    }

    return json({ success: true, settings: updated });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Error updating settings for ${shop}:`, errorMsg);
    return json(
      { error: `Failed to save settings: ${errorMsg}` },
      { status: 500 }
    );
  }
};

export default function SettingsPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [inventoryThreshold, setInventoryThreshold] = useState(
    String(loaderData.inventoryThreshold)
  );
  const [maxPriceIncreasePercent, setMaxPriceIncreasePercent] = useState(
    String(loaderData.maxPriceIncreasePercent)
  );
  const [reviewFrequency, setReviewFrequency] = useState(
    loaderData.reviewFrequency
  );
  const [aiBehaviorPrompt, setAiBehaviorPrompt] = useState(
    loaderData.aiBehaviorPrompt
  );

  // Calculate example max price for live preview
  const exampleCurrentPrice = 100;
  const maxIncreasePercent = parseFloat(maxPriceIncreasePercent) || 0;
  const exampleMaxPrice = exampleCurrentPrice * (1 + maxIncreasePercent / 100);

  return (
    <Page title="AI Pricing Settings">
      <Layout>
        {/* Success Banner */}
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success" title="Settings saved successfully!">
              Your pricing automation settings have been updated and the cron
              schedule has been re-registered.
            </Banner>
          </Layout.Section>
        )}

        {/* Error Banner */}
        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical" title="Error saving settings">
              {actionData.error}
            </Banner>
          </Layout.Section>
        )}

        {/* Single Form wrapping all settings */}
        <Form method="post">
          {/* Inventory Threshold Section */}
          <Layout.Section>
            <Layout.AnnotatedSection
              title="Inventory Threshold"
              description="Pricing automation only applies to products with inventory at or below this level."
            >
              <Card>
                <FormLayout>
                  <TextField
                    label="Inventory Threshold (units)"
                    type="number"
                    value={inventoryThreshold}
                    onChange={setInventoryThreshold}
                    name="inventoryThreshold"
                    min="0"
                    helpText="e.g., 50 means prices only adjust for items with 50 or fewer units in stock"
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    📊 Current threshold: {inventoryThreshold} units
                  </Text>
                </FormLayout>
              </Card>
            </Layout.AnnotatedSection>
          </Layout.Section>

          {/* Max Price Increase Section */}
          <Layout.Section>
            <Layout.AnnotatedSection
              title="Maximum Price Increase Cap"
              description="AI recommendations never exceed this percentage above the current price. This is a safety limit."
            >
              <Card>
                <FormLayout>
                  <TextField
                    label="Maximum Price Increase (%)"
                    type="number"
                    value={maxPriceIncreasePercent}
                    onChange={setMaxPriceIncreasePercent}
                    name="maxPriceIncreasePercent"
                    min="0"
                    helpText="e.g., 50 means a $100 item can never be priced above $150"
                  />
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      <strong>💡 Live Example:</strong>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Current Price: ${exampleCurrentPrice.toFixed(2)}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Maximum Price: ${exampleMaxPrice.toFixed(2)}
                    </Text>
                  </Box>
                </FormLayout>
              </Card>
            </Layout.AnnotatedSection>
          </Layout.Section>

          {/* Review Frequency Section */}
          <Layout.Section>
            <Layout.AnnotatedSection
              title="Review Frequency"
              description="How often the AI pricing cycle runs automatically."
            >
              <Card>
                <FormLayout>
                  <Select
                    label="Automation Schedule"
                    options={[
                      { label: "Hourly (top of every hour)", value: "hourly" },
                      { label: "Daily (3 AM UTC)", value: "daily" },
                      { label: "Weekly (Monday 3 AM UTC)", value: "weekly" },
                      {
                        label: "Monthly (1st of month 3 AM UTC)",
                        value: "monthly",
                      },
                    ]}
                    value={reviewFrequency}
                    onChange={setReviewFrequency}
                    name="reviewFrequency"
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    ⏱️ Currently set to: <strong>{reviewFrequency}</strong>
                  </Text>
                </FormLayout>
              </Card>
            </Layout.AnnotatedSection>
          </Layout.Section>

          {/* AI Behavior Prompt Section */}
          <Layout.Section>
            <Layout.AnnotatedSection
              title="AI Behavior Instructions (Optional)"
              description="Custom instructions for Gemini to personalize pricing recommendations."
            >
              <Card>
                <FormLayout>
                  <TextField
                    label="Custom AI Prompt"
                    type="text"
                    multiline={4}
                    value={aiBehaviorPrompt}
                    onChange={setAiBehaviorPrompt}
                    name="aiBehaviorPrompt"
                    placeholder="e.g., 'Be aggressive with premium products, conservative with budget items. Prioritize margin over volume.'"
                    helpText="Leave blank for default behavior. Your instructions will be included in every pricing recommendation."
                  />
                </FormLayout>
              </Card>
            </Layout.AnnotatedSection>
          </Layout.Section>

          {/* Save Button as form submit */}
          <Layout.Section>
            <Button variant="primary" submit>
              Save Settings
            </Button>
          </Layout.Section>
        </Form>
      </Layout>
    </Page>
  );
}
