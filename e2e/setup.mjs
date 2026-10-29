import 'reflect-metadata';
import cjsModule1 from '../apps/api/dist/db/connection.js';
const {connect}=cjsModule1;
import cjsModule2 from '../apps/api/dist/db/migrate.js';
const {migrateDatabase}=cjsModule2;
import cjsModule3 from '../apps/api/dist/db/seed.js';
const {seedSynthetic}=cjsModule3;
async function setup(){
  const name=process.env.E2E_DATABASE;if(!/^casegraph_t12_[a-f0-9]{32}$/.test(name??''))throw new Error('Invalid isolated database');
  const {db,pool}=connect(name);try{await migrateDatabase(db);await seedSynthetic(db);await migrateDatabase(db);await seedSynthetic(db);}finally{await pool.end();}
  console.log('Fresh isolated synthetic E2E database migrated/seeded twice.');
}
void setup().catch(()=>{console.error('Isolated E2E database setup failed.');process.exitCode=1;});
