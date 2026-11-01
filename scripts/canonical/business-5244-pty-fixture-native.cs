using System;using System.IO;using System.Text;using System.Diagnostics;using System.Threading;using System.Threading.Tasks;using System.Runtime.InteropServices;using System.Security.Principal;using System.Text.RegularExpressions;
// Disposable PTY fixture only. No production library, shared mutex, stop,
// terminate, child-start, adoption, SQL, service or configuration capability.
public static class Business5244PtyFixtureNative {
 const string Ps5=@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";
 const string FixtureLeaf="business-5244-pty-fixture.ps1";
 static int signalAttempted;
 [StructLayout(LayoutKind.Sequential)]struct Unicode {public ushort Length,Maximum;public IntPtr Buffer;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")]static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll")]static extern bool GetProcessTimes(IntPtr handle,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool QueryFullProcessImageName(IntPtr handle,int flags,StringBuilder text,ref int size);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 [DllImport("ntdll.dll")]static extern int NtQueryInformationProcess(IntPtr process,int kind,IntPtr buffer,int size,out int needed);
 [DllImport("shell32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CommandLineToArgvW(string text,out int count);
 [DllImport("kernel32.dll")]static extern IntPtr LocalFree(IntPtr pointer);
 static Exception Error(string code){return new InvalidOperationException("PTY_FIXTURE_"+code);}
 static long Creation(IntPtr handle){long a,b,c,d;if(handle==IntPtr.Zero||!GetProcessTimes(handle,out a,out b,out c,out d))throw Error("BIRTH_UNAVAILABLE");return a;}
 static string Image(IntPtr handle){int size=32768;var text=new StringBuilder(size);if(!QueryFullProcessImageName(handle,0,text,ref size))throw Error("IMAGE_UNAVAILABLE");return text.ToString();}
 static string Sid(IntPtr process){IntPtr token;if(!OpenProcessToken(process,8,out token))throw Error("SID_UNAVAILABLE");try{using(var identity=new WindowsIdentity(token))return identity.User.Value;}finally{CloseHandle(token);}}
 static string[] Arguments(IntPtr process){
  int size;NtQueryInformationProcess(process,60,IntPtr.Zero,0,out size);if(size<Marshal.SizeOf(typeof(Unicode))||size>262144)throw Error("ARGV_UNAVAILABLE");
  int capacity=size;IntPtr buffer=Marshal.AllocHGlobal(size),argv=IntPtr.Zero;
  try{if(NtQueryInformationProcess(process,60,buffer,size,out size)!=0)throw Error("ARGV_UNAVAILABLE");var text=(Unicode)Marshal.PtrToStructure(buffer,typeof(Unicode));if(text.Length%2!=0||text.Length>text.Maximum||text.Buffer.ToInt64()<buffer.ToInt64()+Marshal.SizeOf(typeof(Unicode))||text.Buffer.ToInt64()+text.Length>buffer.ToInt64()+capacity)throw Error("ARGV_UNAVAILABLE");int count;argv=CommandLineToArgvW(Marshal.PtrToStringUni(text.Buffer,text.Length/2),out count);if(argv==IntPtr.Zero||count<1||count>48)throw Error("ARGV_UNAVAILABLE");var result=new string[count];for(int i=0;i<count;i++)result[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(argv,i*IntPtr.Size));return result;}
  finally{if(argv!=IntPtr.Zero)LocalFree(argv);Marshal.FreeHGlobal(buffer);}
 }
 static string FixtureRoot(string root,string nonce){
  if(root==null||nonce==null||!Regex.IsMatch(nonce,"\\A[a-f0-9]{32}\\z"))throw Error("SCOPE_REQUIRED");string full=Path.GetFullPath(root),temp=Path.GetFullPath(Path.GetTempPath()).TrimEnd('\\');
  if(!String.Equals(Path.GetDirectoryName(full),temp,StringComparison.OrdinalIgnoreCase)||Path.GetFileName(full)!="b6-pty-fixture-"+nonce||full.StartsWith(@"C:\Sirket\ERP",StringComparison.OrdinalIgnoreCase))throw Error("TEMP_SCOPE_REQUIRED");
  for(string p=full;!String.IsNullOrEmpty(p);p=Path.GetDirectoryName(p)){if((File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw Error("TEMP_REPARSE_REJECTED");}return full;
 }
 static void AssertArgument(string[] argv,string name,string expected){int at=-1;for(int i=0;i<argv.Length;i++)if(String.Equals(argv[i],name,StringComparison.OrdinalIgnoreCase)){if(at!=-1||i+1>=argv.Length)throw Error("OWNER_ARGV_REQUIRED");at=i;}if(at==-1||argv[at+1]!=expected)throw Error("OWNER_ARGV_REQUIRED");}
 public static string SelfBirth{get{return Creation(GetCurrentProcess()).ToString(System.Globalization.CultureInfo.InvariantCulture);}}
 public static Observation Capture(int pid,string expectedNativeBirth,string tempRoot,string nonce){
  string root=FixtureRoot(tempRoot,nonce);long birth;if(pid<=0||!Regex.IsMatch(expectedNativeBirth??"","\\A[1-9][0-9]{0,17}\\z")||!Int64.TryParse(expectedNativeBirth,out birth))throw Error("TARGET_IDENTITY_REQUIRED");return Observation.Create(pid,birth,root,nonce);
 }
 public sealed class Observation:IDisposable {
  IntPtr handle;readonly int issuerPid,issuerThread;readonly long issuerBirth,birth;readonly string sid,exe,fixtureRoot,fixtureNonce;bool disposed;
  public int Pid{get;private set;}public string Birth{get{return birth.ToString(System.Globalization.CultureInfo.InvariantCulture);}}public string Exe{get{return exe;}}
  private Observation(int pid,long expected,string root,string nonce){
   issuerPid=Process.GetCurrentProcess().Id;issuerThread=Thread.CurrentThread.ManagedThreadId;issuerBirth=Creation(GetCurrentProcess());sid=Sid(GetCurrentProcess());
   if(!String.Equals(Image(GetCurrentProcess()),Ps5,StringComparison.OrdinalIgnoreCase))throw Error("PS5_CONTROLLER_REQUIRED");
   Pid=pid;birth=expected;fixtureRoot=root;fixtureNonce=nonce;handle=OpenProcess(0x00101000,false,pid);
   try{if(handle==IntPtr.Zero||Creation(handle)!=birth||WaitForSingleObject(handle,0)!=258||Sid(handle)!=sid)throw Error("LIVE_TARGET_CHANGED");exe=Image(handle);if(!String.Equals(exe,Ps5,StringComparison.OrdinalIgnoreCase))throw Error("PS5_OWNER_REQUIRED");var args=Arguments(handle);if(args.Length!=16||!Regex.IsMatch(args[13],"\\A[a-f0-9]{64}\\z")||!Regex.IsMatch(args[15],"\\A[a-f0-9]{64}\\z"))throw Error("OWNER_ARGV_REQUIRED");string[] required={Ps5,"-NoLogo","-NoProfile","-NonInteractive","-File",Path.Combine(root,FixtureLeaf),"-Mode","Owner","-TempRoot",root,"-Nonce",nonce,"-SourceSha256",args[13],"-NativeSha256",args[15]};for(int i=0;i<args.Length;i++)if(args[i]!=required[i])throw Error("OWNER_ARGV_REQUIRED");ValidateLive();}
   catch{Dispose();throw;}
  }
  internal static Observation Create(int pid,long birth,string root,string nonce){return new Observation(pid,birth,root,nonce);}
  void Issuer(){if(disposed||handle==IntPtr.Zero||issuerPid!=Process.GetCurrentProcess().Id||issuerThread!=Thread.CurrentThread.ManagedThreadId||issuerBirth!=Creation(GetCurrentProcess())||sid!=Sid(GetCurrentProcess()))throw Error("OBSERVER_CHANGED");}
  public bool ObserveExited(){Issuer();if(Creation(handle)!=birth)throw Error("TARGET_BIRTH_CHANGED");uint state=WaitForSingleObject(handle,0);if(state!=0&&state!=258)throw Error("EXIT_UNKNOWN");if(state==258&&(Sid(handle)!=sid||!String.Equals(Image(handle),exe,StringComparison.OrdinalIgnoreCase)))throw Error("LIVE_TARGET_CHANGED");return state==0;}
  // Capture authenticated the live image/SID. During teardown only this same
  // retained kernel object and its creation time can prove exit; do not reopen
  // a PID or query a disappearing target token/image while waiting.
  public bool WaitForExit(int maxMilliseconds){
   if(maxMilliseconds<0||maxMilliseconds>90000)throw Error("WAIT_BOUND_REQUIRED");
   Issuer();if(Creation(handle)!=birth)throw Error("TARGET_BIRTH_CHANGED");
   uint state=WaitForSingleObject(handle,(uint)maxMilliseconds);
   Issuer();if(Creation(handle)!=birth)throw Error("TARGET_BIRTH_CHANGED");
   if(state==0)return true;if(state==258)return false;throw Error("EXIT_UNKNOWN");
  }
  public void ValidateLive(){if(ObserveExited())throw Error("OWNER_ALREADY_EXITED");}
  public void ValidateExited(){if(!ObserveExited())throw Error("OWNER_EXIT_NOT_OBSERVED");}
  public uint ExitCode{get{ValidateExited();uint code;if(!GetExitCodeProcess(handle,out code))throw Error("EXIT_CODE_UNKNOWN");return code;}}
  internal string ValidateSignalScope(string nonce){ValidateLive();if(nonce!=fixtureNonce)throw Error("NONCE_CHANGED");return fixtureRoot;}
  public void Dispose(){if(disposed)return;if(issuerPid!=Process.GetCurrentProcess().Id||issuerThread!=Thread.CurrentThread.ManagedThreadId||issuerBirth!=Creation(GetCurrentProcess()))throw Error("FOREIGN_DISPOSE");disposed=true;if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
 }
 public sealed class SignalObservation {
  public string Value{get;private set;}public string StartedUtc{get;private set;}public string FinishedUtc{get;private set;}public double ElapsedMilliseconds{get;private set;}public bool TimedOut{get;private set;}public string FailureCode{get;private set;}
  private SignalObservation(string value,string start,string finish,double elapsed,bool timedOut,string failure){Value=value;StartedUtc=start;FinishedUtc=finish;ElapsedMilliseconds=elapsed;TimedOut=timedOut;FailureCode=failure;}
  internal static SignalObservation Create(string value,string start,string finish,double elapsed,bool timedOut,string failure){return new SignalObservation(value,start,finish,elapsed,timedOut,failure);}
 }
 static int RunspaceId(){foreach(var a in AppDomain.CurrentDomain.GetAssemblies()){if(a.GetName().Name!="System.Management.Automation")continue;var type=a.GetType("System.Management.Automation.Runspaces.Runspace",true);var current=type.GetProperty("DefaultRunspace").GetValue(null,null);if(current==null)throw Error("RUNSPACE_REQUIRED");return (int)type.GetProperty("Id").GetValue(current,null);}throw Error("RUNSPACE_REQUIRED");}
 public static SignalObservation ReadSignalOnce(Observation owner,string nonce){
  if(owner==null)throw Error("OWNER_OBSERVER_REQUIRED");string root=owner.ValidateSignalScope(nonce);int runspace=RunspaceId();if(runspace!=1)throw Error("MAIN_RUNSPACE_REQUIRED");
  if(Interlocked.Exchange(ref signalAttempted,1)!=0)throw Error("SIGNAL_ALREADY_READ");
  var clock=Stopwatch.StartNew();DateTime started=DateTime.UtcNow;string start=started.ToString("o"),value=null,failure=null;bool timedOut=false;
  string ready="{\"schema\":\"melisa-b6-pty-fixture-ready.v1\",\"phase\":\"PTY_FIXTURE_READY\",\"nonce\":\""+nonce+"\",\"ownerPid\":"+owner.Pid+",\"ownerBirth\":\""+owner.Birth+"\",\"fixtureRoot\":\""+root.Replace("\\","\\\\").Replace("\"","\\\"")+"\",\"runspaceId\":1,\"guardMilliseconds\":60000,\"startedUtc\":\""+start+"\",\"deadlineUtc\":\""+started.AddMilliseconds(60000).ToString("o")+"\",\"monoTicks\":"+Stopwatch.GetTimestamp()+"}";
  Console.WriteLine(ready);Console.Out.Flush();
  try{var read=Task.Run(()=>Console.ReadLine());int remaining=Math.Max(0,60000-(int)Math.Min(60000,clock.ElapsedMilliseconds));if(!read.Wait(remaining))timedOut=true;else value=read.GetAwaiter().GetResult();}catch{failure="PTY_FIXTURE_SIGNAL_IO_FAILED";}
  clock.Stop();if(clock.Elapsed.TotalMilliseconds>=60000){timedOut=true;value=null;}return SignalObservation.Create(value,start,DateTime.UtcNow.ToString("o"),clock.Elapsed.TotalMilliseconds,timedOut,failure);
 }
}
