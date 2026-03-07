import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSimilarItems } from '@/lib/similar'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await getSimilarItems(id)

  return NextResponse.json(result)
}
