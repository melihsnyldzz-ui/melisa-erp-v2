using System;using System.Text;using System.Runtime.InteropServices;
public sealed class Business5244WebNative:IDisposable {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct SI{public int cb;public string r,desktop,title;public int x,y,xs,ys,xc,yc,fill,flags;public short show,r2;public IntPtr reserved,input,output,error;}
 [StructLayout(LayoutKind.Sequential)] struct SIX{public SI si;public IntPtr attributes;}
 [StructLayout(LayoutKind.Sequential)] struct PI{public IntPtr process,thread;public int pid,tid;}
 [StructLayout(LayoutKind.Sequential)] struct BASICJOB{public long processTime,jobTime;public uint flags;public UIntPtr min,max;public uint count;public UIntPtr affinity;public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct IO{public ulong a,b,c,d,e,f;}
 [StructLayout(LayoutKind.Sequential)] struct JOB{public BASICJOB basic;public IO io;public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")]static extern uint GetCurrentProcessId();
 [DllImport("kernel32.dll")]static extern bool GetProcessTimes(IntPtr h,out long birth,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern IntPtr CreateJobObject(IntPtr attrs,string name);
 [DllImport("kernel32.dll")]static extern bool SetInformationJobObject(IntPtr h,int type,ref JOB info,int size);
 [DllImport("kernel32.dll")]static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll")]static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")]static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool CreateProcess(string app,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string cwd,ref SIX startup,out PI pi);
 [DllImport("kernel32.dll")]static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")]static extern bool TerminateProcess(IntPtr child,uint code);
 IntPtr job,child;readonly uint owner;readonly long ownerBirth;long childBirth;bool disposed,spawned,stopped;
 public string OwnerBirth{get{return ownerBirth.ToString(System.Globalization.CultureInfo.InvariantCulture);}}
 public int ChildPid{get;private set;}public string ChildBirth{get{return childBirth.ToString(System.Globalization.CultureInfo.InvariantCulture);}}
 public bool RetirementConfirmed{get{return spawned&&disposed&&child==IntPtr.Zero&&job==IntPtr.Zero;}}
 public static bool MatchesCimBirth(long native,long cim){return cim%10==0?native/10==cim/10:native==cim;}
 public Business5244WebNative(){owner=GetCurrentProcessId();long b,c,d;if(!GetProcessTimes(GetCurrentProcess(),out ownerBirth,out b,out c,out d))throw new Exception("OWNER_BIRTH_UNAVAILABLE");job=CreateJobObject(IntPtr.Zero,null);JOB j=new JOB();j.basic.flags=0x2000;if(job==IntPtr.Zero||!SetInformationJobObject(job,9,ref j,Marshal.SizeOf(typeof(JOB)))){Dispose();throw new Exception("NATIVE_JOB_UNAVAILABLE");}}
 public void Validate(){long a,b,c,d;if(disposed||owner!=GetCurrentProcessId()||!GetProcessTimes(GetCurrentProcess(),out a,out b,out c,out d)||a!=ownerBirth)throw new Exception("OWNER_NOT_CURRENT");}
 public bool ChildAlive(){Validate();if(child==IntPtr.Zero)return false;long a,b,c,d;if(!GetProcessTimes(child,out a,out b,out c,out d)||a!=childBirth)throw new Exception("CHILD_HANDLE_CHANGED");return WaitForSingleObject(child,0)==258;}
 public void Spawn(string executable,string arguments,string cwd){Validate();if(spawned)throw new Exception("CHILD_ALREADY_CREATED");spawned=true;IntPtr size=IntPtr.Zero,list=IntPtr.Zero,value=IntPtr.Zero;PI p=new PI();try{InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);list=Marshal.AllocHGlobal(size);value=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(value,job);if(!InitializeProcThreadAttributeList(list,1,0,ref size)||!UpdateProcThreadAttribute(list,0,(IntPtr)0x0002000D,value,(IntPtr)IntPtr.Size,IntPtr.Zero,IntPtr.Zero))throw new Exception("ATOMIC_CHILD_JOB_UNAVAILABLE");SIX si=new SIX();si.si.cb=Marshal.SizeOf(typeof(SIX));si.attributes=list;string command="\""+executable+"\" "+arguments;if(!CreateProcess(executable,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,false,0x08080004,IntPtr.Zero,cwd,ref si,out p))throw new Exception("OWNED_WEB_CHILD_CREATE_FAILED");child=p.process;ChildPid=p.pid;long b,c,d;if(!GetProcessTimes(child,out childBirth,out b,out c,out d)||ResumeThread(p.thread)==0xffffffff||!ChildAlive())throw new Exception("OWNED_WEB_CHILD_START_FAILED");}finally{if(p.thread!=IntPtr.Zero)CloseHandle(p.thread);if(list!=IntPtr.Zero){DeleteProcThreadAttributeList(list);Marshal.FreeHGlobal(list);}if(value!=IntPtr.Zero)Marshal.FreeHGlobal(value);}}
 public void Stop(){if(stopped)throw new Exception("CHILD_STOP_REENTRY");if(!ChildAlive())throw new Exception("CHILD_NOT_LIVE");stopped=true;if(!TerminateProcess(child,1)||WaitForSingleObject(child,10000)!=0)throw new Exception("CHILD_STOP_NOT_CONFIRMED");}
 public void Dispose(){if(disposed)return;if(job!=IntPtr.Zero){if(!CloseHandle(job))throw new Exception("OWNED_WEB_JOB_CLOSE_UNCONFIRMED");job=IntPtr.Zero;}if(child!=IntPtr.Zero){if(WaitForSingleObject(child,10000)!=0)throw new Exception("OWNED_WEB_CHILD_EXIT_UNCONFIRMED");if(!CloseHandle(child))throw new Exception("OWNED_WEB_HANDLE_CLOSE_UNCONFIRMED");child=IntPtr.Zero;}disposed=true;}
}
