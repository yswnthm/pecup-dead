require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function promoteAllToSemester2() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Fetching all semester 2 records...');

  // Get all semester 2 entries (one per year_id)
  const { data: sem2Records, error: semError } = await supabase
    .from('semesters')
    .select('id, year_id, semester_number')
    .eq('semester_number', 2);

  if (semError || !sem2Records || sem2Records.length === 0) {
    console.error('❌ Could not fetch semester 2 records:', semError);
    return;
  }

  console.log(`✅ Found ${sem2Records.length} semester-2 records:`);
  sem2Records.forEach(s => console.log(`   year_id=${s.year_id} → sem2_id=${s.id}`));

  // Build a map: year_id -> semester_2_id
  const yearToSem2 = {};
  sem2Records.forEach(s => { yearToSem2[s.year_id] = s.id; });

  console.log('\n🔍 Fetching all profiles...');
  const { data: profiles, error: profError } = await supabase
    .from('profiles')
    .select('id, email, year_id, semester_id');

  if (profError || !profiles) {
    console.error('❌ Could not fetch profiles:', profError);
    return;
  }

  console.log(`✅ Found ${profiles.length} profiles.\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles) {
    const sem2Id = yearToSem2[profile.year_id];

    if (!sem2Id) {
      console.warn(`⚠️  No semester 2 found for year_id=${profile.year_id} (${profile.email}) — skipping`);
      skipped++;
      continue;
    }

    if (profile.semester_id === sem2Id) {
      console.log(`⏭️  Already on sem 2: ${profile.email}`);
      skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ semester_id: sem2Id })
      .eq('id', profile.id);

    if (updateError) {
      console.error(`❌ Failed to update ${profile.email}:`, updateError.message);
      failed++;
    } else {
      console.log(`✅ Updated ${profile.email} → semester 2`);
      updated++;
    }
  }

  console.log(`\n📊 Done! updated=${updated}, skipped=${skipped}, failed=${failed}`);
}

promoteAllToSemester2();
