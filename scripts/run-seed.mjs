import postgres from 'postgres'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Get database password from command line argument
const dbPassword = process.argv[2]

if (!dbPassword) {
  console.error('Usage: node scripts/run-seed.mjs <database-password>')
  console.error('The database password is the one you set when creating the Supabase project.')
  process.exit(1)
}

// Connection string for Supabase (direct connection)
const connectionString = `postgresql://postgres.jiuxsintslqryrvgevmc:${dbPassword}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`

const sql = postgres(connectionString)

// Read the seed SQL file
const seedPath = join(__dirname, '..', 'supabase', 'seed.sql')
const seedSQL = readFileSync(seedPath, 'utf-8')

async function runSeed() {
  try {
    console.log('Connecting to database...')
    
    // Run the entire seed file
    console.log('Running seed SQL...')
    await sql.unsafe(seedSQL)
    
    console.log('✓ Seed data inserted successfully!')
    
    // Verify some data was inserted
    const programmes = await sql`SELECT COUNT(*) as count FROM programmes`
    const pipelines = await sql`SELECT COUNT(*) as count FROM pipelines`
    const stages = await sql`SELECT COUNT(*) as count FROM pipeline_stages`
    const lists = await sql`SELECT COUNT(*) as count FROM lists`
    const tags = await sql`SELECT COUNT(*) as count FROM tags`
    
    console.log('\nVerification:')
    console.log(`  - Programmes: ${programmes[0].count}`)
    console.log(`  - Pipelines: ${pipelines[0].count}`)
    console.log(`  - Pipeline Stages: ${stages[0].count}`)
    console.log(`  - Lists: ${lists[0].count}`)
    console.log(`  - Tags: ${tags[0].count}`)
    
  } catch (error) {
    console.error('Error running seed:', error.message)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

runSeed()
