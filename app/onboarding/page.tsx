'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Loader from '@/components/Loader'

type BranchType = 'CSE' | 'AIML' | 'DS' | 'AI' | 'ECE' | 'EEE' | 'MEC' | 'CE'
const BRANCHES: BranchType[] = ['CSE', 'AIML', 'DS', 'AI', 'ECE', 'EEE', 'MEC', 'CE']

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [name, setName] = useState('')
  const [year, setYear] = useState<number | undefined>(undefined)
  const [branch, setBranch] = useState<BranchType | ''>('')
  const [rollNumber, setRollNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login')
    if (status === 'authenticated' && session?.user?.name && !name) setName(session.user.name)
  }, [status, session, router, name])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      // Validate required fields
      if (!name || !branch || !year || !rollNumber) {
        throw new Error('All fields are required')
      }

      // Map frontend data to database IDs via API
      const mappingResponse = await fetch('/api/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchCode: branch,
          yearNumber: year,
          semesterNumber: 2 // Currently 2nd semester for all years
        }),
      })

      const mappingJson = await mappingResponse.json()
      console.log('Mapping API response:', { status: mappingResponse.status, mappingJson })
      if (!mappingResponse.ok) {
        throw new Error(mappingJson?.error || 'Failed to map branch/year data')
      }

      console.log('Mapping response:', mappingJson)

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          branch_id: mappingJson.branch_id,
          year_id: mappingJson.year_id,
          semester_id: mappingJson.semester_id,
          roll_number: rollNumber
        }),
      })
      const json = await response.json().catch(() => ({}))
      console.log('Profile API response:', { status: response.status, json })
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to save profile')
      }
      router.replace('/home')
    } catch (err: any) {
      console.error('Profile creation error:', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading' || isSubmitting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>We use this to personalize your experience</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={session?.user?.email ?? ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year?.toString() ?? ''} onValueChange={(v) => setYear(parseInt(v))}>
                  <SelectTrigger id="year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={branch} onValueChange={(v: BranchType) => setBranch(v)}>
                  <SelectTrigger id="branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll">Roll number</Label>
              <Input id="roll" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save and continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


