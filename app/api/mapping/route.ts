import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';
import { academicConfig } from '@/lib/academic-config';

interface MappingRequest {
  branchCode: string;
  yearNumber: number;
  semesterNumber?: number;
}

interface MappingResponse {
  branch_id: string;
  year_id: string;
  semester_id: string;
}

export async function POST(request: Request) {
  let body: MappingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { branchCode, yearNumber, semesterNumber = 2 } = body;

  if (!branchCode || typeof branchCode !== 'string') {
    return NextResponse.json({ error: 'Branch code is required and must be a string' }, { status: 400 });
  }

  if (!yearNumber || typeof yearNumber !== 'number') {
    return NextResponse.json({ error: 'Year number is required and must be a number' }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    // Handle year mapping - if it's an academic year (1-4), convert to batch year
    let batchYear: number;
    if (yearNumber >= 1 && yearNumber <= 4) {
      // Dynamic calculation anchored to September academic cycle start
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11
      const academicStartMonth = 9; // September

      // Calculate current academic cohort base year
      // If current month is before September, we're still in the previous academic year
      const cohortBaseYear = currentMonth < academicStartMonth ? currentYear - 1 : currentYear;

      // Derive batch year: Year 1 -> cohortBaseYear, Year 2 -> cohortBaseYear - 1, etc.
      batchYear = cohortBaseYear - (yearNumber - 1);
    } else {
      // Assume it's already a batch year or handle invalid input
      if (!Number.isInteger(yearNumber) || yearNumber < 1) {
        // Safe fallback to current calendar year if yearNumber is missing or invalid
        batchYear = new Date().getFullYear();
      } else {
        batchYear = yearNumber;
      }
    }

    // Get branch ID
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('id')
      .eq('code', branchCode)
      .single();

    if (branchError || !branch) {
      return NextResponse.json({ error: `Invalid branch code: ${branchCode}` }, { status: 400 });
    }

    // Get year ID
    const { data: year, error: yearError } = await supabase
      .from('years')
      .select('id')
      .eq('batch_year', batchYear)
      .single();

    if (yearError || !year) {
      return NextResponse.json({ error: `Invalid year: ${batchYear}` }, { status: 400 });
    }

    // Get semester ID
    const { data: semester, error: semesterError } = await supabase
      .from('semesters')
      .select('id')
      .eq('year_id', year.id)
      .eq('semester_number', semesterNumber)
      .single();

    if (semesterError || !semester) {
      return NextResponse.json({ error: `Invalid semester: ${semesterNumber} for year ${batchYear}` }, { status: 400 });
    }

    const response: MappingResponse = {
      branch_id: branch.id,
      year_id: year.id,
      semester_id: semester.id
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Mapping error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
