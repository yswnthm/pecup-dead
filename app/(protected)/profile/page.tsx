'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useProfile } from '@/lib/enhanced-profile-context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

type BranchType = 'CSE' | 'AIML' | 'DS' | 'AI' | 'ECE' | 'EEE' | 'MEC' | 'CE'
const BRANCHES: BranchType[] = ['CSE', 'AIML', 'DS', 'AI', 'ECE', 'EEE', 'MEC', 'CE']


export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { profile, loading: profileLoading, error: profileError, refreshProfile } = useProfile()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [year, setYear] = useState<number | undefined>(undefined)
  const [branch, setBranch] = useState<BranchType | ''>('')
  const [rollNumber, setRollNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (status !== 'loading' && status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  useEffect(() => {
    // Use cached profile data from context
    if (profile) {
      setName(profile.name || '')
      setYear(profile.year ?? undefined)
      setBranch((profile.branch as BranchType | null) || '')
      setRollNumber(profile.roll_number || '')
    } else if (profileError && status === 'authenticated') {
      // If profile missing, send to onboarding
      router.replace('/onboarding')
    }
  }, [profile, profileError, status, router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
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
      if (!mappingResponse.ok) {
        throw new Error(mappingJson?.error || 'Failed to map branch/year data')
      }

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
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to save profile')
      }
      setSuccess('Profile updated successfully!')
      // Refetch profile to update context
      await refreshProfile()
      // Auto-redirect after 2 seconds
      setTimeout(() => router.push('/home'), 2000)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      console.error('Profile update error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'loading' || profileLoading) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Email field skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              {/* Name field skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              {/* Year and Branch fields skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              
              {/* Roll number field skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              {/* Buttons skeleton */}
              <div className="flex gap-3">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Update your details anytime</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4">
              <AlertDescription>{success}</AlertDescription>
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
            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save changes'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/home')}>Back to Home</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}


