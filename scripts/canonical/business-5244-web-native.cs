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
// An immutable-package read seal, not process/adoption authority. Opening with
// FileShare.Read forbids writes/deletion for the entire prepare/request window.
// Validation is cheap; payload hashing happened before any peer request existed.
public sealed class Business5244PackageSeal:IDisposable {
 readonly int pid=System.Diagnostics.Process.GetCurrentProcess().Id;
 readonly int thread=System.Threading.Thread.CurrentThread.ManagedThreadId;
 readonly System.Collections.Generic.Dictionary<string,System.IO.FileStream> files=new System.Collections.Generic.Dictionary<string,System.IO.FileStream>(StringComparer.OrdinalIgnoreCase);
 readonly System.Collections.Generic.Dictionary<string,string> hashes=new System.Collections.Generic.Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
 sealed class Identity {
  public Microsoft.Win32.SafeHandles.SafeFileHandle Handle;public uint Volume,High,Low;public bool Directory;
 }
 [StructLayout(LayoutKind.Sequential)] struct INFO {
  public uint Attributes,CreationLow,CreationHigh,AccessLow,AccessHigh,WriteLow,WriteHigh,Volume,SizeHigh,SizeLow,Links,High,Low;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern Microsoft.Win32.SafeHandles.SafeFileHandle CreateFile(string name,uint access,uint share,IntPtr security,uint mode,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(Microsoft.Win32.SafeHandles.SafeFileHandle handle,out INFO info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandle(Microsoft.Win32.SafeHandles.SafeFileHandle handle,StringBuilder path,uint length,uint flags);
 readonly System.Collections.Generic.Dictionary<string,Identity> directories=new System.Collections.Generic.Dictionary<string,Identity>(StringComparer.OrdinalIgnoreCase);
 readonly System.Collections.Generic.Dictionary<string,Identity> identities=new System.Collections.Generic.Dictionary<string,Identity>(StringComparer.OrdinalIgnoreCase);
 bool frozen,disposed;
 public string PolicyVersion{get{return "test125-package-file-identity.v2";}}
 public int Count{get{return files.Count;}}
 void Owner(){if(disposed||pid!=System.Diagnostics.Process.GetCurrentProcess().Id||thread!=System.Threading.Thread.CurrentThread.ManagedThreadId)throw new InvalidOperationException("PACKAGE_SEAL_NOT_CURRENT");}
 Identity Capture(Microsoft.Win32.SafeHandles.SafeFileHandle handle,string path,bool directory){
  INFO info;if(handle.IsClosed||handle.IsInvalid||!GetFileInformationByHandle(handle,out info)||(info.Attributes&0x400)!=0||((info.Attributes&0x10)!=0)!=directory)throw new InvalidOperationException("PACKAGE_SEAL_PATH_IDENTITY_CHANGED");
  var final=new StringBuilder(32768);uint size=GetFinalPathNameByHandle(handle,final,(uint)final.Capacity,0);
  string actual=final.ToString();if(actual.StartsWith(@"\\?\",StringComparison.Ordinal))actual=actual.Substring(4);
  if(size==0||size>=final.Capacity||!String.Equals(actual.TrimEnd('\\'),path.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("PACKAGE_SEAL_PATH_IDENTITY_CHANGED");
  return new Identity{Handle=handle,Volume=info.Volume,High=info.High,Low=info.Low,Directory=directory};
 }
 void PinDirectory(string path){
  path=System.IO.Path.GetFullPath(path);if(directories.ContainsKey(path))return;
  string parent=System.IO.Path.GetDirectoryName(path);if(!String.IsNullOrEmpty(parent)&&!String.Equals(parent,path,StringComparison.OrdinalIgnoreCase))PinDirectory(parent);
  // Share writes to unrelated files/directories normally. Do not share DELETE:
  // no ancestor can be renamed/replaced while payload handles are retained.
  var handle=CreateFile(path,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
  try{directories.Add(path,Capture(handle,path,true));}catch{handle.Dispose();throw;}
 }
 void ValidateIdentity(Identity identity){
  INFO info;if(identity.Handle.IsClosed||identity.Handle.IsInvalid||!GetFileInformationByHandle(identity.Handle,out info)||(info.Attributes&0x400)!=0||((info.Attributes&0x10)!=0)!=identity.Directory||info.Volume!=identity.Volume||info.High!=identity.High||info.Low!=identity.Low)throw new InvalidOperationException("PACKAGE_SEAL_PATH_IDENTITY_CHANGED");
 }
 public void Add(string path,string expected){
  Owner();if(frozen)throw new InvalidOperationException("PACKAGE_SEAL_FROZEN");path=System.IO.Path.GetFullPath(path);
  if(files.ContainsKey(path)){if(!String.Equals(hashes[path],expected,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("PACKAGE_SEAL_HASH_CONFLICT");return;}
  PinDirectory(System.IO.Path.GetDirectoryName(path));
  var file=new System.IO.FileStream(path,System.IO.FileMode.Open,System.IO.FileAccess.Read,System.IO.FileShare.Read);
  try{var identity=Capture(file.SafeFileHandle,path,false);string actual;using(var sha=System.Security.Cryptography.SHA256.Create()){actual=BitConverter.ToString(sha.ComputeHash(file)).Replace("-","").ToLowerInvariant();}
   if(!String.Equals(actual,expected,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("PACKAGE_SEAL_CONTENT_CHANGED");
   file.Position=0;files.Add(path,file);hashes.Add(path,actual);identities.Add(path,identity);
  }catch{file.Dispose();throw;}
 }
 public void Freeze(){Owner();if(frozen||files.Count==0)throw new InvalidOperationException("PACKAGE_SEAL_NOT_PREPARED");frozen=true;Validate();}
 public void Validate(){Owner();if(!frozen)throw new InvalidOperationException("PACKAGE_SEAL_NOT_PREPARED");foreach(var file in files.Values){if(!file.CanRead||file.SafeFileHandle.IsClosed||file.SafeFileHandle.IsInvalid)throw new InvalidOperationException("PACKAGE_SEAL_LOST_HANDLE");}foreach(var identity in identities.Values)ValidateIdentity(identity);foreach(var identity in directories.Values)ValidateIdentity(identity);}
 public void Dispose(){if(disposed)return;foreach(var file in files.Values)file.Dispose();foreach(var identity in directories.Values)identity.Handle.Dispose();files.Clear();hashes.Clear();identities.Clear();directories.Clear();disposed=true;}
}
