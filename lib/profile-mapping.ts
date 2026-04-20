import { createSupabaseAdmin } from './supabase';

interface MappingResult {
  branch_id: string;
  year_id: string;
  semester_id: string;
}

/**
 * Maps frontend branch code, year, and semester to database UUIDs
 * @param branchCode - Branch code like 'CSE', 'AIML', etc.
 * @param yearNumber - Academic year number (1-4) or batch year (2023, 2024, etc.)
 * @param semesterNumber - Semester number (1 or 2), defaults to 2
 * @returns Promise resolving to database IDs
 */
export async function mapProfileDataToIds(
  branchCode: string,
  yearNumber: number,
  semesterNumber: number = 2
): Promise<MappingResult> {
  const supabase = createSupabaseAdmin();

  // Handle year mapping - if it's an academic year (1-4), convert to batch year
  let batchYear: number;
  if (yearNumber >= 1 && yearNumber <= 4) {
    // Dynamic computation using July UTC cutoff
    const currentDate = new Date();
    const currentYear = currentDate.getUTCFullYear();
    const currentMonth = currentDate.getUTCMonth() + 1; // getUTCMonth() returns 0-11

    // If month >= July (7), set baseBatch = currentYear, otherwise baseBatch = currentYear - 1
    const baseBatch = currentMonth >= 7 ? currentYear : currentYear - 1;

    // Compute batchYear = baseBatch - (yearNumber - 1)
    // Year 1 -> baseBatch, Year 2 -> baseBatch - 1, etc.
    batchYear = baseBatch - (yearNumber - 1);
  } else {
    // Assume it's already a batch year or handle invalid input
    if (!Number.isInteger(yearNumber) || yearNumber < 1) {
      // Check for DB-driven fallback behind env flag
      const allowYearFallback = process.env.ALLOW_YEAR_FALLBACK === '1';
      if (allowYearFallback) {
        try {
          // Query the years table for the latest batch_year
          const { data: latestYear, error } = await supabase
            .from('years')
            .select('batch_year')
            .order('batch_year', { ascending: false })
            .limit(1)
            .single();

          if (!error && latestYear?.batch_year) {
            batchYear = latestYear.batch_year;
          } else {
            throw new Error('Database query failed or returned no results');
          }
        } catch (dbError) {
          throw new Error(
            `Invalid yearNumber: ${yearNumber}. DB fallback failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}. ` +
            'Valid yearNumber must be an integer >= 1. ' +
            'Check ALLOW_YEAR_FALLBACK env var and database connectivity. ' +
            'See docs/database_info.md for year configuration details.'
          );
        }
      } else {
        throw new Error(
          `Invalid yearNumber: ${yearNumber}. Must be an integer between 1-4 or a valid batch year (>= 1). ` +
          'Set ALLOW_YEAR_FALLBACK=1 to enable database-driven fallback for invalid inputs. ' +
          'See docs/database_info.md for year configuration details.'
        );
      }
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
    throw new Error(`Invalid branch code: ${branchCode}`);
  }

  // Get year ID
  const { data: year, error: yearError } = await supabase
    .from('years')
    .select('id')
    .eq('batch_year', batchYear)
    .single();

  if (yearError || !year) {
    throw new Error(`Invalid year: ${batchYear}`);
  }

  // Get semester ID
  const { data: semester, error: semesterError } = await supabase
    .from('semesters')
    .select('id')
    .eq('year_id', year.id)
    .eq('semester_number', semesterNumber)
    .single();

  if (semesterError || !semester) {
    throw new Error(`Invalid semester: ${semesterNumber} for year ${batchYear}`);
  }

  return {
    branch_id: branch.id,
    year_id: year.id,
    semester_id: semester.id
  };
}

/**
 * Reverse mapping: Convert database IDs back to frontend format
 * @param branchId - Branch UUID
 * @param yearId - Year UUID
 * @param semesterId - Semester UUID
 * @returns Promise resolving to frontend format
 */
export async function mapIdsToProfileData(
  branchId: string,
  yearId: string,
  semesterId: string
): Promise<{ branch: string; year: number; semester: number }> {
  const supabase = createSupabaseAdmin();

  // Get branch code
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('code')
    .eq('id', branchId)
    .single();

  if (branchError || !branch) {
    throw new Error(`Invalid branch ID: ${branchId}`);
  }

  // Get year data
  const { data: year, error: yearError } = await supabase
    .from('years')
    .select('batch_year')
    .eq('id', yearId)
    .single();

  if (yearError || !year) {
    throw new Error(`Invalid year ID: ${yearId}`);
  }

  // Get semester data
  const { data: semester, error: semesterError } = await supabase
    .from('semesters')
    .select('semester_number')
    .eq('id', semesterId)
    .single();

  if (semesterError || !semester) {
    throw new Error(`Invalid semester ID: ${semesterId}`);
  }

  return {
    branch: branch.code,
    year: year.batch_year,
    semester: semester.semester_number
  };
}
