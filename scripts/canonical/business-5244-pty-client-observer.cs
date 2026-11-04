using System;using System.IO;using System.Text;using System.Diagnostics;using System.Threading;using System.Runtime.InteropServices;using System.Security.Principal;using System.Security.Cryptography;using System.Text.RegularExpressions;using System.Collections.Generic;using Microsoft.Win32.SafeHandles;
// Fresh observation of a disposable client only. This is not a historical
// creator/session token and exposes no stop/start/control/close-console API.
public sealed class Business5244PtyClientObserver:IDisposable {
 const string Ps5=@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";
 [StructLayout(LayoutKind.Sequential)]struct Info{public uint attrs,c0,c1,a0,a1,w0,w1,volume,sizeHigh,sizeLow,links,indexHigh,indexLow;}
 [StructLayout(LayoutKind.Sequential)]struct Unicode{public ushort Length,Maximum;public IntPtr Buffer;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")]static extern bool GetProcessTimes(IntPtr h,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")]static extern bool GetExitCodeProcess(IntPtr h,out uint code);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(IntPtr h,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern bool QueryFullProcessImageName(IntPtr h,int flags,StringBuilder text,ref int size);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint mode,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info info);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern uint GetFinalPathNameByHandle(SafeFileHandle h,StringBuilder text,uint size,uint flags);
 [DllImport("ntdll.dll")]static extern int NtQueryInformationProcess(IntPtr process,int kind,IntPtr data,int size,out int needed);
 [DllImport("shell32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern IntPtr CommandLineToArgvW(string text,out int count);
 [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr value);
 sealed class DirectoryPin{internal SafeFileHandle Handle;internal Info Identity;}
 readonly int issuerPid,issuerThread;readonly long issuerBirth;readonly string issuerSid;
 readonly List<DirectoryPin> directories=new List<DirectoryPin>();FileStream source;Info sourceIdentity;IntPtr process;long birth;bool disposed;
 public int Pid{get;private set;}public string Birth{get{return birth.ToString(System.Globalization.CultureInfo.InvariantCulture);}}public string Exe{get;private set;}public string SourceSha256{get;private set;}public string AdmissionUtc{get;private set;}public string FixtureRoot{get;private set;}public string Nonce{get;private set;}
 // Deliberately false: learning the current kernel birth cannot recover a
 // lost original birth or attest which bytes the process executed at birth.
 public bool OriginalBirthKnown{get{return false;}}
 static Exception Error(string code){return new InvalidOperationException("PTY_CLIENT_"+code);}
 static long Creation(IntPtr h){long a,b,c,d;if(h==IntPtr.Zero||!GetProcessTimes(h,out a,out b,out c,out d))throw Error("BIRTH_UNAVAILABLE");return a;}
 static string Sid(IntPtr h){IntPtr t;if(!OpenProcessToken(h,8,out t))throw Error("SID_UNAVAILABLE");try{using(var id=new WindowsIdentity(t))return id.User.Value;}finally{CloseHandle(t);}}
 static string Image(IntPtr h){int n=32768;var text=new StringBuilder(n);if(!QueryFullProcessImageName(h,0,text,ref n))throw Error("IMAGE_UNAVAILABLE");return text.ToString();}
 static string[] Arguments(IntPtr h){
  int n;NtQueryInformationProcess(h,60,IntPtr.Zero,0,out n);if(n<Marshal.SizeOf(typeof(Unicode))||n>262144)throw Error("ARGV_UNAVAILABLE");int capacity=n;IntPtr b=Marshal.AllocHGlobal(n),av=IntPtr.Zero;
  try{if(NtQueryInformationProcess(h,60,b,n,out n)!=0)throw Error("ARGV_UNAVAILABLE");var s=(Unicode)Marshal.PtrToStructure(b,typeof(Unicode));if(s.Length%2!=0||s.Length>s.Maximum||s.Buffer.ToInt64()<b.ToInt64()+Marshal.SizeOf(typeof(Unicode))||s.Buffer.ToInt64()+s.Length>b.ToInt64()+capacity)throw Error("ARGV_UNAVAILABLE");int count;av=CommandLineToArgvW(Marshal.PtrToStringUni(s.Buffer,s.Length/2),out count);if(av==IntPtr.Zero||count<1||count>16)throw Error("ARGV_UNAVAILABLE");var args=new string[count];for(int i=0;i<count;i++)args[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(av,i*IntPtr.Size));return args;}finally{if(av!=IntPtr.Zero)LocalFree(av);Marshal.FreeHGlobal(b);}
 }
 static bool Same(Info a,Info b){return a.volume==b.volume&&a.indexHigh==b.indexHigh&&a.indexLow==b.indexLow&&a.c0==b.c0&&a.c1==b.c1;}
 static string FinalPath(SafeFileHandle h){var b=new StringBuilder(32768);uint n=GetFinalPathNameByHandle(h,b,(uint)b.Capacity,0);if(n==0||n>=b.Capacity)throw Error("PATH_UNAVAILABLE");string path=b.ToString();return path.StartsWith(@"\\?\",StringComparison.Ordinal)?path.Substring(4):path;}
 void PinDirectories(string path){string parent=Path.GetDirectoryName(path);if(!String.IsNullOrEmpty(parent)&&!String.Equals(parent,path,StringComparison.OrdinalIgnoreCase))PinDirectories(parent);var h=CreateFile(path,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);try{Info i;if(h.IsInvalid||!GetFileInformationByHandle(h,out i)||(i.attrs&0x410)!=0x10||!String.Equals(FinalPath(h).TrimEnd('\\'),path.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw Error("DIRECTORY_REJECTED");directories.Add(new DirectoryPin{Handle=h,Identity=i});}catch{h.Dispose();throw;}}
 void PinSource(){
  PinDirectories(FixtureRoot);string path=Path.Combine(FixtureRoot,"client.ps1");var h=CreateFile(path,0x80000000,1,IntPtr.Zero,3,0x00200080,IntPtr.Zero);
  try{if(h.IsInvalid||!GetFileInformationByHandle(h,out sourceIdentity)||(sourceIdentity.attrs&0x410)!=0||sourceIdentity.links!=1||sourceIdentity.sizeHigh!=0||sourceIdentity.sizeLow==0||sourceIdentity.sizeLow>4194304||!String.Equals(FinalPath(h),path,StringComparison.OrdinalIgnoreCase))throw Error("SOURCE_REJECTED");source=new FileStream(h,FileAccess.Read);ValidateSource();}catch{if(source!=null){source.Dispose();source=null;}else h.Dispose();throw;}
 }
 void ValidateSource(){
  foreach(var d in directories){Info i;if(d.Handle.IsClosed||d.Handle.IsInvalid||!GetFileInformationByHandle(d.Handle,out i)||!Same(i,d.Identity)||(i.attrs&0x410)!=0x10)throw Error("DIRECTORY_CHANGED");}
  Info file;if(source==null||!source.CanRead||source.SafeFileHandle.IsClosed||!GetFileInformationByHandle(source.SafeFileHandle,out file)||!Same(file,sourceIdentity)||(file.attrs&0x410)!=0||file.links!=1||file.sizeHigh!=sourceIdentity.sizeHigh||file.sizeLow!=sourceIdentity.sizeLow)throw Error("SOURCE_CHANGED");
  source.Position=0;string actual;try{using(var sha=SHA256.Create())actual=BitConverter.ToString(sha.ComputeHash(source)).Replace("-","").ToLowerInvariant();}finally{source.Position=0;}if(actual!=SourceSha256)throw Error("SOURCE_HASH_CHANGED");
 }
 private Business5244PtyClientObserver(int pid,string root,string nonce,string sha){
  issuerPid=Process.GetCurrentProcess().Id;issuerThread=Thread.CurrentThread.ManagedThreadId;issuerBirth=Creation(GetCurrentProcess());issuerSid=Sid(GetCurrentProcess());
  try{
   if(pid<=0||nonce==null||!Regex.IsMatch(nonce,"\\A[a-f0-9]{32}\\z")||sha==null||!Regex.IsMatch(sha,"\\A[a-f0-9]{64}\\z")||root==null)throw Error("FIXTURE_SCOPE_REQUIRED");
   FixtureRoot=Path.GetFullPath(root);Nonce=nonce;SourceSha256=sha;string temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\');if(!String.Equals(Path.GetDirectoryName(FixtureRoot),temp,StringComparison.OrdinalIgnoreCase)||Path.GetFileName(FixtureRoot)!="b6-pty-fixture-"+nonce||FixtureRoot.StartsWith(@"C:\Sirket\ERP",StringComparison.OrdinalIgnoreCase))throw Error("TEMP_SCOPE_REQUIRED");
   PinSource();Pid=pid;process=OpenProcess(0x00101000,false,pid);if(process==IntPtr.Zero){int error=Marshal.GetLastWin32Error();throw Error(error==87?"PID_ABSENT":"PROCESS_QUERY_UNKNOWN");}
   if(WaitForSingleObject(process,0)!=258||Sid(process)!=issuerSid)throw Error("LIVE_CLIENT_CHANGED");Exe=Image(process);if(!String.Equals(Exe,Ps5,StringComparison.OrdinalIgnoreCase))throw Error("PS5_CLIENT_REQUIRED");
   var args=Arguments(process);string[] required={Ps5,"-NoLogo","-NoProfile","-NoExit","-File",Path.Combine(FixtureRoot,"client.ps1")};if(args.Length!=required.Length)throw Error("CLIENT_ARGV_REQUIRED");for(int i=0;i<args.Length;i++)if(args[i]!=required[i])throw Error("CLIENT_ARGV_REQUIRED");
   // Fresh identity is published only after this exact live provenance proof.
   birth=Creation(process);AdmissionUtc=DateTime.UtcNow.ToString("o");ValidateLive();
  }catch{Release();throw;}
 }
 public static Business5244PtyClientObserver CaptureKnownClient(int pid,string root,string nonce,string sourceSha256){return new Business5244PtyClientObserver(pid,root,nonce,sourceSha256);}
 void Issuer(){if(disposed||process==IntPtr.Zero||issuerPid!=Process.GetCurrentProcess().Id||issuerThread!=Thread.CurrentThread.ManagedThreadId||issuerBirth!=Creation(GetCurrentProcess())||issuerSid!=Sid(GetCurrentProcess()))throw Error("OBSERVER_CHANGED");}
 public void ValidateLive(){Issuer();ValidateSource();if(Creation(process)!=birth||WaitForSingleObject(process,0)!=258||Sid(process)!=issuerSid||!String.Equals(Image(process),Exe,StringComparison.OrdinalIgnoreCase))throw Error("LIVE_CLIENT_CHANGED");var args=Arguments(process);string[] required={Ps5,"-NoLogo","-NoProfile","-NoExit","-File",Path.Combine(FixtureRoot,"client.ps1")};if(args.Length!=required.Length)throw Error("CLIENT_ARGV_CHANGED");for(int i=0;i<args.Length;i++)if(args[i]!=required[i])throw Error("CLIENT_ARGV_CHANGED");}
 public bool WaitForExit(int maxMilliseconds){if(maxMilliseconds<0||maxMilliseconds>60000)throw Error("WAIT_BOUND_REQUIRED");Issuer();if(Creation(process)!=birth)throw Error("CLIENT_BIRTH_CHANGED");uint state=WaitForSingleObject(process,(uint)maxMilliseconds);Issuer();if(Creation(process)!=birth)throw Error("CLIENT_BIRTH_CHANGED");if(state==0)return true;if(state==258)return false;throw Error("EXIT_UNKNOWN");}
 public uint ExitCode{get{if(!WaitForExit(0))throw Error("CLIENT_NOT_EXITED");uint code;if(!GetExitCodeProcess(process,out code))throw Error("EXIT_CODE_UNKNOWN");return code;}}
 void Release(){if(disposed)return;if(process!=IntPtr.Zero){CloseHandle(process);process=IntPtr.Zero;}if(source!=null){source.Dispose();source=null;}foreach(var d in directories)d.Handle.Dispose();directories.Clear();disposed=true;}
 public void Dispose(){if(disposed)return;if(issuerPid!=Process.GetCurrentProcess().Id||issuerThread!=Thread.CurrentThread.ManagedThreadId||issuerBirth!=Creation(GetCurrentProcess()))throw Error("FOREIGN_DISPOSE");Release();}
}
