from runpy import run_path
import subprocess,json,time
x=run_path('/tmp/schoolos-slice0a-evidence/run-gates.py');env=x['env'];root=x['root'];out=x['out']
base='postgresql://schoolos:slice0a-local-only@127.0.0.1:55433/'
env['SCHOOLOS_AUTH_TEST_DATABASE_URL']=base+'schoolos_auth_recovery_test?schema=public'
env['SCHOOLOS_ADMISSION_TEST_DATABASE_URL']=base+'schoolos_admission_atomic_test?schema=public'
for db in ['schoolos_auth_recovery_test','schoolos_admission_atomic_test']:
 e=env.copy();e['DATABASE_URL']=base+db+'?schema=public'
 with (out/(db+'-migrate.log')).open('w') as f:
  p=subprocess.run('pnpm --filter @schoolos/api exec prisma migrate deploy',shell=True,cwd=root,env=e,stdout=f,stderr=subprocess.STDOUT)
 print(db,p.returncode,flush=True)
commands=[('typecheck-repair','pnpm typecheck'),('unit-repair','pnpm test'),('integration-full','pnpm test:integration')]
for name,cmd in commands:
 print('START',name,flush=True);t=time.time()
 with (out/(name+'.log')).open('w') as f:p=subprocess.run(cmd,shell=True,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
 with (out/'results.jsonl').open('a') as f:f.write(json.dumps({'gate':name,'command':cmd,'exit':p.returncode,'seconds':round(time.time()-t,2),'sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()})+'\n')
 print('END',name,p.returncode,flush=True)
