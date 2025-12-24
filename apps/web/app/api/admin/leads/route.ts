import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory storage for leads (acts as abandoned quotes for admin)
const leads = new Map<string, any>()

export async function GET() {
  try {
    const allLeads = Array.from(leads.values())
    
    // Sort by most recent first
    allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      leads: allLeads,
      count: allLeads.length
    })
  } catch (error) {
    console.error('Failed to fetch leads:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leads' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const leadData = await request.json()
    
    // Store lead with timestamp
    const leadWithMeta = {
      ...leadData,
      id: `lead-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'abandoned'
    }

    leads.set(leadWithMeta.id, leadWithMeta)

    console.log(`Stored lead/abandoned quote: ${leadWithMeta.id}`, {
      email: leadData.email,
      quoteId: leadData.quoteId,
      files: leadData.files?.length || 0
    })

    return NextResponse.json(leadWithMeta)
  } catch (error) {
    console.error('Failed to store lead:', error)
    return NextResponse.json(
      { error: 'Failed to store lead' },
      { status: 500 }
    )
  }
}

// For admin: expose the internal storage
export const getLeadsForAdmin = () => Array.from(leads.values())
export const addLead = (leadData: any) => {
  const leadWithMeta = {
    ...leadData,
    id: `lead-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'abandoned'
  }
  leads.set(leadWithMeta.id, leadWithMeta)
  return leadWithMeta
}
