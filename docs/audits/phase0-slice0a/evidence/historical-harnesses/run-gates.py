import os,subprocess,json,time,pathlib
root=pathlib.Path('/Users/erwin/Projects/SchoolOS'); out=pathlib.Path('/tmp/schoolos-slice0a-evidence')
env=os.environ.copy(); env.update({'PATH':'/Users/erwin/.nvm/versions/node/v22.23.2/bin:'+env['PATH'],'NODE_ENV':'development','ALLOW_PROD_BOOT':'false','PORT':'4400','DATABASE_URL':'postgresql://schoolos:slice0a-local-only@127.0.0.1:55433/schoolos_baseline?schema=public','REDIS_HOST':'127.0.0.1','REDIS_PORT':'56379','JWT_SECRET':'ci-e2e-jwt-secret-not-for-production-use','JWT_CHALLENGE_SECRET':'ci-e2e-challenge-secret-not-for-production-use','TOKEN_HASH_PEPPER':'ci-e2e-token-pepper-not-for-production-use','MEDICAL_ENCRYPTION_KEY':'ci-e2e-medical-key-not-for-production-use','JWT_ISSUER':'schoolos','JWT_AUDIENCE_WEB':'schoolos-web','JWT_AUDIENCE_MOBILE':'schoolos-mobile','FRONTEND_ORIGIN':'http://localhost:3101','PASSWORD_RESET_APP_URL':'http://localhost:3101/reset-password','SCHOOLOS_DEMO_PASSWORD':'ci-e2e-demo-password-not-for-production-use','SCHOOLOS_DEMO_PASSWORDS_REQUIRE_CHANGE':'false','PLATFORM_SEED_PASSWORD_REQUIRE_CHANGE':'false'})
commands=[('install22','pnpm install --frozen-lockfile'),('generate','pnpm db:generate'),('validate','pnpm db:validate'),('tracked','pnpm verify:tracked-artifacts'),('environment','pnpm verify:env:deploy'),('openapi','pnpm verify:openapi'),('lint','pnpm lint'),('api-eslint','pnpm --filter @schoolos/api lint:check'),('typecheck','pnpm typecheck'),('unit','pnpm test'),('api-e2e','pnpm test:e2e'),('migration','pnpm --filter @schoolos/api exec prisma migrate deploy'),('migration-status','pnpm --filter @schoolos/api exec prisma migrate status'),('integration','pnpm test:integration'),('build','pnpm build'),('seed','pnpm db:seed')]
if __name__=='__main__':
 for name,cmd in commands:
  t=time.time(); print('START',name,flush=True)
  with (out/(name+'.log')).open('w') as f:
   p=subprocess.run(cmd,shell=True,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
  row={'gate':name,'command':cmd,'exit':p.returncode,'seconds':round(time.time()-t,2),'sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'dirty':subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True)}
  with (out/'results.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
  print('END',name,p.returncode,flush=True)
