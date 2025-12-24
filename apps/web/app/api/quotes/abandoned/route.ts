import { NextRequest, NextResponse } from "next/server";
import { abandonedQuotes } from "../../../../lib/storage";

interface LocalAbandonedQuoteData {
  quoteId: string;
  userId?: string;
  guestEmail?: string;
  currentStep:
    | "file_upload"
    | "pricing_review"
    | "checkout_started"
    | "payment_info";
  files: Array<{
    fileId: string;
    fileName: string;
    fileSize?: number;
    contentType?: string;
  }>;
  selectedLeadOptions?: {
    [lineId: string]: string; // lineId -> leadOptionId mapping
  };
  customizations?: {
    [lineId: string]: {
      material?: string;
      finish?: string;
      quantity?: number;
    };
  };
  checkoutData?: {
    shippingAddress?: any;
    billingAddress?: any;
    selectedPaymentMethod?: string;
  };
  leadContact?: {
    email: string;
    phone: string;
    fingerprint?: string;
    submittedAt: string;
  };
  quoteSummary?: {
    totalFiles: number;
    processedFiles: number;
    estimatedPrice?: number;
    estimatedTime?: string;
  };
  lastActivity: string;
  abandonedAt: string;
}

// Using shared storage for abandoned quotes

export async function POST(request: NextRequest) {
  try {
    const abandonedData: LocalAbandonedQuoteData = await request.json();

    // Validate required fields
    if (!abandonedData.quoteId || !abandonedData.currentStep) {
      return NextResponse.json(
        { error: "Missing required fields: quoteId, currentStep" },
        { status: 400 },
      );
    }

    // Set timestamp
    abandonedData.abandonedAt = new Date().toISOString();

    // Store abandoned quote data
    await abandonedQuotes.set(abandonedData.quoteId, abandonedData);

    console.log(
      `Saved abandoned quote ${abandonedData.quoteId} at step ${abandonedData.currentStep}`,
      {
        email: abandonedData.leadContact?.email,
        phone: abandonedData.leadContact?.phone,
        files: abandonedData.files?.length || 0,
      },
    );

    return NextResponse.json({
      success: true,
      quoteId: abandonedData.quoteId,
      message: "Quote data saved for later recovery",
    });
  } catch (error) {
    console.error("Failed to save abandoned quote:", error);
    return NextResponse.json(
      { error: "Failed to save abandoned quote data" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const guestEmail = searchParams.get("guestEmail");
    const quoteId = searchParams.get("quoteId");

    if (quoteId) {
      // Get specific abandoned quote
      const abandonedQuote = await abandonedQuotes.get(quoteId);
      if (!abandonedQuote) {
        return NextResponse.json(
          { error: "Abandoned quote not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(abandonedQuote);
    }

    // Get all abandoned quotes for user/email
    const allQuotes = await abandonedQuotes.getAll();
    const userQuotes = allQuotes.filter((quote) => {
      if (userId && quote.userId === userId) return true;
      if (guestEmail && quote.guestEmail === guestEmail) return true;
      return false;
    });

    // Sort by most recently abandoned
    userQuotes.sort(
      (a, b) =>
        new Date(b.abandonedAt).getTime() - new Date(a.abandonedAt).getTime(),
    );

    return NextResponse.json({
      quotes: userQuotes,
      count: userQuotes.length,
    });
  } catch (error) {
    console.error("Failed to retrieve abandoned quotes:", error);
    return NextResponse.json(
      { error: "Failed to retrieve abandoned quotes" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteId = searchParams.get("quoteId");

    if (!quoteId) {
      return NextResponse.json(
        { error: "Missing quoteId parameter" },
        { status: 400 },
      );
    }

    const deleted = await abandonedQuotes.delete(quoteId);

    if (!deleted) {
      return NextResponse.json(
        { error: "Abandoned quote not found" },
        { status: 404 },
      );
    }

    console.log(`Deleted abandoned quote ${quoteId}`);

    return NextResponse.json({
      success: true,
      message: "Abandoned quote removed",
    });
  } catch (error) {
    console.error("Failed to delete abandoned quote:", error);
    return NextResponse.json(
      { error: "Failed to delete abandoned quote" },
      { status: 500 },
    );
  }
}
