// In-process cooperative web-owner component. No service, discovery, adoption,
// PID kill, installed-state loader or process-global ownership claim.
using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Threading;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Net;

namespace Melisa.CleanWeb1056 {
 public sealed class Claim {
  public long Generation; public int Pid; public long Birth;
  public string Exe, Cwd, Arguments, Artifact;
 }
 public sealed class Lease {
  internal Owner Owner; internal long Generation, Deadline; internal bool Closed;
  internal string Id; internal readonly List<FileStream> Held = new List<FileStream>();
  internal readonly Dictionary<string,string> Hashes = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  internal byte[] Before; internal string ControlHash;
  internal Lease() { }
  public string TransitionId { get { return Id; } }
 }
 public sealed class Outcome {
  public string TransitionId {get;internal set;} public string State {get;internal set;}
  public string Artifact {get;internal set;} public string BeforeSha256 {get;internal set;}
  public string PublishedSha256 {get;internal set;} public long Generation {get;internal set;}
  public int Pid {get;internal set;} public bool OldRetired {get;internal set;} public bool FinalAcknowledged {get;internal set;}
 }
 internal sealed class Child : IDisposable {
  internal Process Process; internal IntPtr Handle; internal long Birth;
  internal string Exe, Cwd, Arguments, Artifact; internal int Pid;
  readonly string[] expectedArguments;
  volatile bool logFailed;
  void Log(Action<string,bool> sink,string line,bool error){try{sink(line,error);}catch{logFailed=true;}}
  internal Child(string exe,string cwd,string[] args,string artifact,bool fixtureWitness,Action<string,bool> log,IDictionary<string,string> webEnvironment) {
   Exe=Path.GetFullPath(exe); Cwd=Path.GetFullPath(cwd); Artifact=artifact;
   expectedArguments=(string[])args.Clone();Arguments=String.Join(" ",Array.ConvertAll(expectedArguments,Kernel.Quote));
   var si=new ProcessStartInfo(Exe,Arguments) { WorkingDirectory=Cwd,UseShellExecute=false,
    CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true };
   si.EnvironmentVariables.Clear();
   foreach(string name in new[]{"SystemRoot","WINDIR","PATH","PATHEXT","TEMP","TMP","COMSPEC","LOCALAPPDATA"}){var value=Environment.GetEnvironmentVariable(name);if(value!=null)si.EnvironmentVariables[name]=value;}
   si.EnvironmentVariables["NODE_ENV"]="production";
   foreach(var p in webEnvironment)si.EnvironmentVariables[p.Key]=p.Value;
   // This returned Process owns CreateProcess's original kernel handle. It is
   // never reopened from a PID or reconstructed from JSON/CIM after startup.
   Process=System.Diagnostics.Process.Start(si);
   try { Handle=Process.Handle; Pid=Process.Id; Birth=Kernel.Creation(Handle); Verify();
    // Controlled fixture worker gives a live CWD/argv witness from birth.
    if(fixtureWitness) { var hello=Process.StandardOutput.ReadLineAsync();
     if(!hello.Wait(5000)||hello.Result!=Pid.ToString()+"|"+Cwd+"|"+expectedArguments[0]) throw new InvalidOperationException("WEB_BIRTH_WITNESS"); }
    Verify();
    if(!fixtureWitness) {
     Process.OutputDataReceived+=(s,e)=>{if(e.Data!=null)Log(log,e.Data,false);};
     Process.ErrorDataReceived+=(s,e)=>{if(e.Data!=null)Log(log,e.Data,true);};
     Process.BeginOutputReadLine();Process.BeginErrorReadLine();
    }
   } catch { try { if(!Kernel.Exited(Handle)) Kernel.Stop(Handle,Birth); } finally { Process.Dispose(); } throw; }
  }
  internal void Verify() {
   if(logFailed)throw new InvalidOperationException("WEB_LOG_SINK_FAILED");
   if(Process==null||Kernel.Exited(Handle)||Kernel.Creation(Handle)!=Birth||
    !String.Equals(Kernel.Image(Handle),Exe,StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("WEB_CHILD_IDENTITY");
   var argv=Kernel.Arguments(Handle);
   if(argv.Length!=expectedArguments.Length+1||!String.Equals(argv[0],Exe,StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("WEB_CHILD_ARGV");
   for(int i=0;i<expectedArguments.Length;i++)if(argv[i+1]!=expectedArguments[i])throw new InvalidOperationException("WEB_CHILD_ARGV");
  }
  internal bool Exited { get { if(Kernel.Creation(Handle)!=Birth) throw new InvalidOperationException("WEB_CHILD_BIRTH"); return Kernel.Exited(Handle); } }
  internal void Stop() { Verify(); Kernel.Stop(Handle,Birth); }
  public void Dispose() { if(Process!=null) { Process.Dispose(); Process=null; } }
 }
 internal static class Kernel {
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr h,out long c,out long e,out long k,out long u);
  [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h,int flags,StringBuilder s,ref int n);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h,uint t);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr h,uint code);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h,int kind,IntPtr buffer,int size,out int needed);
  [DllImport("shell32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern IntPtr CommandLineToArgvW(string s,out int n);
  [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
  [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern uint GetLongPathName(string input,StringBuilder output,int size);
  [DllImport("iphlpapi.dll",SetLastError=true)] static extern uint GetExtendedTcpTable(IntPtr table,ref int size,bool order,int family,int tableClass,int reserved);
  [StructLayout(LayoutKind.Sequential)] struct Unicode { public ushort Length,Maximum; public IntPtr Buffer; }
  internal static long Creation(IntPtr h) { long a,b,c,d;if(h==IntPtr.Zero||!GetProcessTimes(h,out a,out b,out c,out d)) throw new InvalidOperationException("WEB_HANDLE_BIRTH");return a; }
  internal static string LongPath(string p){var s=new StringBuilder(32768);uint n=GetLongPathName(Path.GetFullPath(p),s,s.Capacity);if(n==0||n>=s.Capacity)throw new InvalidOperationException("WEB_PATH_UNREADABLE");return s.ToString();}
  internal static bool Exited(IntPtr h) { var r=WaitForSingleObject(h,0);if(r==0)return true;if(r==258)return false;throw new InvalidOperationException("WEB_HANDLE_WAIT"); }
  internal static string Image(IntPtr h) { int n=32768;var b=new StringBuilder(n);if(!QueryFullProcessImageName(h,0,b,ref n))throw new InvalidOperationException("WEB_HANDLE_IMAGE");return b.ToString(); }
  internal static string[] Arguments(IntPtr h) {
   int needed;NtQueryInformationProcess(h,60,IntPtr.Zero,0,out needed);
   if(needed<Marshal.SizeOf(typeof(Unicode))||needed>262144)throw new InvalidOperationException("WEB_HANDLE_ARGV");
   int capacity=needed;var b=Marshal.AllocHGlobal(capacity);IntPtr av=IntPtr.Zero;
   try { if(NtQueryInformationProcess(h,60,b,needed,out needed)!=0)throw new InvalidOperationException("WEB_HANDLE_ARGV");
    var s=(Unicode)Marshal.PtrToStructure(b,typeof(Unicode));int count;
    if(s.Length%2!=0||s.Length>s.Maximum||s.Buffer.ToInt64()<b.ToInt64()+Marshal.SizeOf(typeof(Unicode))||s.Buffer.ToInt64()+s.Length>b.ToInt64()+capacity)throw new InvalidOperationException("WEB_HANDLE_ARGV");
    av=CommandLineToArgvW(Marshal.PtrToStringUni(s.Buffer,s.Length/2),out count);
    if(av==IntPtr.Zero||count<1||count>64)throw new InvalidOperationException("WEB_HANDLE_ARGV");
    var result=new string[count];for(int i=0;i<count;i++)result[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(av,i*IntPtr.Size));return result;
   } finally { if(av!=IntPtr.Zero)LocalFree(av);Marshal.FreeHGlobal(b); }
  }
  internal static void Stop(IntPtr h,long birth) { if(Creation(h)!=birth||Exited(h))throw new InvalidOperationException("WEB_STOP_IDENTITY");if(!TerminateProcess(h,0)||WaitForSingleObject(h,10000)!=0)throw new InvalidOperationException("WEB_STOP_NOT_CONFIRMED"); }
  // Fixed production WEB port only. No discovery/adoption result is returned;
  // every LISTEN row must belong to the already-retained own child handle.
  internal static void AssertFixedWebListener(int ownedPid) {
   int found=0;
   foreach(int family in new[]{2,23}) {
    int n=0;uint first=GetExtendedTcpTable(IntPtr.Zero,ref n,false,family,5,0);
    if(first!=122||n<4||n>16777216)throw new InvalidOperationException("WEB_PORT_UNREADABLE");
    IntPtr b=Marshal.AllocHGlobal(n);
    try {
     if(GetExtendedTcpTable(b,ref n,false,family,5,0)!=0)throw new InvalidOperationException("WEB_PORT_UNREADABLE");
     int count=Marshal.ReadInt32(b),width=family==2?24:56;
     if(count<0||4L+(long)count*width>n)throw new InvalidOperationException("WEB_PORT_UNREADABLE");
     for(int i=0;i<count;i++) {
      int offset=4+i*width,state=Marshal.ReadInt32(b,offset+(family==2?0:48));
      int raw=Marshal.ReadInt32(b,offset+(family==2?8:20)),port=((raw&255)<<8)|((raw>>8)&255);
      if(state!=2||port!=5244)continue;
      int pid=Marshal.ReadInt32(b,offset+(family==2?20:52));
      if(pid!=ownedPid)throw new InvalidOperationException("WEB_FOREIGN_LISTENER");found++;
     }
    }finally{Marshal.FreeHGlobal(b);}
   }
   if(found==0)throw new InvalidOperationException("WEB_PORT_NOT_READY");
  }
  internal static string Quote(string s) { if(s.IndexOf('"')>=0||s.IndexOf('\r')>=0||s.IndexOf('\n')>=0)throw new InvalidOperationException("WEB_ARGUMENT");return "\""+s+"\""; }
  internal static string UnquoteSingle(string s) { return s.Substring(1,s.Length-2); }
 }
 // Trusted-host embedding contract, NOT a public runtime admission API. The
 // existing immutable-package verifier must issue frozen expected bytes, and
 // the existing host must supply its actual cooperative writer gate BEFORE
 // creating a child. Current legacy bootstrap supplies neither; PS stays shut.
 // No caller JSON/boolean/mutex/empty-port record can create this internal type.
 internal sealed class CooperativeBirthBinding {
  internal readonly string NewPrivateStateRoot;
  internal readonly SemaphoreSlim ActualHostWriterGate;
  internal readonly Dictionary<string,string> VerifiedPackageAndProtectionPins;
  internal readonly Action<string,bool> ExistingWebLogSink;
  internal readonly Func<byte[]> ReadFreshPreservedBoundary;
  internal readonly Dictionary<string,string> ExistingApprovedWebEnvironment;
  internal CooperativeBirthBinding(string state,SemaphoreSlim gate,Dictionary<string,string> pins,Action<string,bool> logger,Func<byte[]> witness,Dictionary<string,string> webEnvironment) {
   if(state==null||gate==null||pins==null||logger==null||witness==null||webEnvironment==null)throw new InvalidOperationException("WEB_BOOTSTRAP_BINDING_MISSING");
   NewPrivateStateRoot=state;ActualHostWriterGate=gate;VerifiedPackageAndProtectionPins=new Dictionary<string,string>(pins,StringComparer.OrdinalIgnoreCase);
   ExistingWebLogSink=logger;
   ReadFreshPreservedBoundary=witness;
   ExistingApprovedWebEnvironment=new Dictionary<string,string>(webEnvironment,StringComparer.Ordinal);
  }
 }
 public sealed class Owner : IDisposable {
  readonly string root,node,rollbackEntry,candidateEntry,control,protection;
  readonly Dictionary<string,string> pins=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  readonly SemaphoreSlim gate; readonly int hostPid; readonly bool fixture;
  readonly Action<string,bool> log;
  readonly Func<byte[]> preservedBoundary;
  readonly Dictionary<string,string> webEnvironment;
  readonly List<FileStream> birthPins=new List<FileStream>();
  readonly List<Child> born=new List<Child>(); Child current,old,candidate;
  long generation=1; Lease active,last; Outcome receipt; string lastAckRequest,phase="Owned"; bool disposed;
  Owner(string dir,string exe,CooperativeBirthBinding binding) {
   root=Path.GetFullPath(dir).TrimEnd(Path.DirectorySeparatorChar);node=Path.GetFullPath(exe);hostPid=Process.GetCurrentProcess().Id;
   fixture=binding==null;gate=fixture?new SemaphoreSlim(1,1):binding.ActualHostWriterGate;log=fixture?null:binding.ExistingWebLogSink;
   webEnvironment=fixture?new Dictionary<string,string>():new Dictionary<string,string>(binding.ExistingApprovedWebEnvironment,StringComparer.Ordinal);
   if(gate==null)throw new InvalidOperationException("WEB_BOOTSTRAP_WRITER_GATE_MISSING");
   rollbackEntry=fixture?Path.Combine(root,"rollback","worker.cjs"):Path.Combine(RollbackRoot,"apps","sites-workflow","node_modules","vite","bin","vite.js");
   candidateEntry=fixture?Path.Combine(root,"candidate","worker.cjs"):Path.Combine(CandidateRoot,"apps","sites-workflow","node_modules","vite","bin","vite.js");
   control=Path.Combine(root,"publication.json");protection=Path.Combine(root,"protected.bin");
   preservedBoundary=fixture?(Func<byte[]>)(()=>File.ReadAllBytes(Path.Combine(root,"live-protection.bin"))):binding.ReadFreshPreservedBoundary;
   if(fixture) { foreach(var f in new[]{node,rollbackEntry,candidateEntry,Path.Combine(root,"rollback.manifest"),Path.Combine(root,"candidate.manifest"),protection}) { NoReparse(f);pins.Add(f,Hash(File.ReadAllBytes(f))); } }
   else { foreach(var p in binding.VerifiedPackageAndProtectionPins){NoReparse(p.Key);if(Hash(File.ReadAllBytes(p.Key))!=p.Value)throw new InvalidOperationException("WEB_BOOTSTRAP_PIN_CHANGED");pins.Add(p.Key,p.Value);} }
   try {
    // Freeze verified bytes BEFORE the first CreateProcess, not only on the
    // later handoff. Birth and handoff use the same exact expected snapshots.
    foreach(var p in pins){var f=new FileStream(p.Key,FileMode.Open,FileAccess.Read,FileShare.Read);birthPins.Add(f);if(Hash(Bytes(f))!=p.Value)throw new InvalidOperationException("WEB_PIN_CHANGED");}
    WriteNew(control,Encoding.UTF8.GetBytes("rollback\n"));current=Birth(rollbackEntry,"rollback");old=current;
   }catch{foreach(var f in birthPins)f.Dispose();throw;}
  }
  // Offline host is deliberately not a runtime bootstrap issuer. Its entire
  // root must be a newly-owned temp fixture; no installed process can be passed.
  public static Owner StartOwnedFixture(string dir,string exe) {
   var full=Kernel.LongPath(dir).TrimEnd(Path.DirectorySeparatorChar);var temp=Kernel.LongPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar);
   if(!String.Equals(Path.GetDirectoryName(full),temp,StringComparison.OrdinalIgnoreCase)||!Path.GetFileName(full).StartsWith("melisa-web-owner-",StringComparison.Ordinal))throw new InvalidOperationException("WEB_FIXTURE_SCOPE");
   foreach(var f in new[]{"publication.json","owner.claim"})if(File.Exists(Path.Combine(full,f)))throw new InvalidOperationException("WEB_NO_ADOPTION");
   NoReparse(full);WriteNew(Path.Combine(full,"owner.claim"),Encoding.UTF8.GetBytes(Guid.NewGuid().ToString("N")));return new Owner(full,exe,null);
  }
  internal const string CandidateRoot="C:\\Sirket\\ERP\\releases\\CLEAN-ERP-WEB-20261025-b89cc651-B6AUTHHEIGHT-WEBONLY";
  internal const string RollbackRoot="C:\\Sirket\\ERP\\releases\\CLEAN-ERP-WEB-20261025-b89cc651dc26-B5FINANCEPROFILE";
  // Genuine narrow production birth implementation, available only to an
  // integrated trusted host. No current code issues CooperativeBirthBinding.
  // This does not retroactively establish exclusion of legacy/unknown writers.
  internal static Owner StartNewWebFromCooperatingHost(CooperativeBirthBinding b) {
   if(b==null||b.ActualHostWriterGate==null||b.VerifiedPackageAndProtectionPins==null)throw new InvalidOperationException("WEB_BOOTSTRAP_BINDING_MISSING");
   string exe="C:\\Sirket\\ERP\\tools\\node-v24.19.0\\node.exe",candidate=Path.Combine(CandidateRoot,"release-manifest.json"),rollback=Path.Combine(RollbackRoot,"release-manifest.json");
   var required=new Dictionary<string,string> {{exe,"3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237"},{candidate,"61328e6bced8de827c00a4672329b5fae3e417ff04007e3b60549085b5a3bab2"},{rollback,"ded6325d0c9bc55316199a7e21463135e42fc0ae5b08fb4d00fa26eb7aa58a72"}};
   foreach(var p in required){string value;if(!b.VerifiedPackageAndProtectionPins.TryGetValue(p.Key,out value)||value!=p.Value)throw new InvalidOperationException("WEB_BOOTSTRAP_PACKAGE_PIN");}
   string state=Path.GetFullPath(b.NewPrivateStateRoot),baseDir="C:\\Sirket\\ERP\\clean\\20261022\\runtime\\web-owner-from-birth\\";
   if(!state.StartsWith(baseDir,StringComparison.OrdinalIgnoreCase)||File.Exists(Path.Combine(state,"owner.claim"))||File.Exists(Path.Combine(state,"publication.json")))throw new InvalidOperationException("WEB_NO_ADOPTION");
   NoReparse(state);
   var env=b.ExistingApprovedWebEnvironment;
   if(env.Count!=5||!env.ContainsKey("MELISA_CLEAN_TEST")||env["MELISA_CLEAN_TEST"]!="20261022"||!env.ContainsKey("MELISA_CLEAN_UI_NETWORK")||env["MELISA_CLEAN_UI_NETWORK"]!="lan-tailscale-20261022"||!env.ContainsKey("CLEAN_SOURCE_COMMIT")||env["CLEAN_SOURCE_COMMIT"]!="b9dd984876c808482017365556538078601187b8"||!env.ContainsKey("CLEAN_PACKAGE_ID")||env["CLEAN_PACKAGE_ID"]!="CLEAN-ERP-20261022-b9dd984876c8"||!env.ContainsKey("MELISA_CLEAN_UI_TAILSCALE_PEERS")||String.IsNullOrEmpty(env["MELISA_CLEAN_UI_TAILSCALE_PEERS"]))throw new InvalidOperationException("WEB_BOOTSTRAP_ENVIRONMENT");
   string protectedPin;if(!b.VerifiedPackageAndProtectionPins.TryGetValue(Path.Combine(state,"protected.bin"),out protectedPin))throw new InvalidOperationException("WEB_BOOTSTRAP_PROTECTION_MISSING");
   foreach(string entry in new[]{Path.Combine(CandidateRoot,"apps","sites-workflow","node_modules","vite","bin","vite.js"),Path.Combine(RollbackRoot,"apps","sites-workflow","node_modules","vite","bin","vite.js"),Path.Combine(CandidateRoot,"apps","sites-workflow","dist","legacy-admin.html"),Path.Combine(RollbackRoot,"apps","sites-workflow","dist","legacy-admin.html")})if(!b.VerifiedPackageAndProtectionPins.ContainsKey(entry))throw new InvalidOperationException("WEB_BOOTSTRAP_PAYLOAD_PIN_MISSING");
   if(Hash(b.ReadFreshPreservedBoundary())!=protectedPin)throw new InvalidOperationException("WEB_PRESERVED_BOUNDARY_CHANGED");
   if(!b.ActualHostWriterGate.Wait(0))throw new InvalidOperationException("WEB_WRITER_BUSY");
   try { WriteNew(Path.Combine(state,"owner.claim"),Encoding.UTF8.GetBytes(Guid.NewGuid().ToString("N")));return new Owner(state,exe,b); }
   finally { b.ActualHostWriterGate.Release(); }
  }
  static void NoReparse(string p) { for(var x=Path.GetFullPath(p);!String.IsNullOrEmpty(x);x=Path.GetDirectoryName(x))if((File.Exists(x)||Directory.Exists(x))&&(File.GetAttributes(x)&FileAttributes.ReparsePoint)!=0)throw new InvalidOperationException("WEB_REPARSE"); }
  static void WriteNew(string p,byte[] b){using(var s=new FileStream(p,FileMode.CreateNew,FileAccess.Write,FileShare.Read)){s.Write(b,0,b.Length);s.Flush(true);}}
  static string Hash(byte[] bytes) { using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(bytes)).Replace("-","").ToLowerInvariant(); }
  static byte[] Bytes(FileStream f) { f.Position=0;var b=new byte[checked((int)f.Length)];int n=0;while(n<b.Length){int r=f.Read(b,n,b.Length-n);if(r==0)throw new IOException("WEB_READ_TRUNCATED");n+=r;}f.Position=0;return b; }
  static long Clock { get { return Stopwatch.GetTimestamp(); } }
  Child Birth(string entry,string artifact) {
   if(Hash(preservedBoundary())!=pins[protection])throw new InvalidOperationException("WEB_PRESERVED_BOUNDARY_CHANGED");
   string cwd=fixture?Path.GetDirectoryName(entry):Path.GetFullPath(Path.Combine(Path.GetDirectoryName(entry),"..","..",".."));
   string[] args=fixture?new[]{entry}:new[]{entry,"preview","--host","127.0.0.1","--port","5244","--strictPort"};
   var c=new Child(node,cwd,args,fixture?artifact:(artifact=="candidate"?"b89+CSSb6":"b89"),fixture,log,webEnvironment);born.Add(c);return c;
  }
  void Host() { if(disposed||Process.GetCurrentProcess().Id!=hostPid)throw new InvalidOperationException("WEB_OWNER_GONE"); }
  public Claim CurrentClaim() { Host();current.Verify();return new Claim { Generation=generation,Pid=current.Pid,Birth=current.Birth,Exe=current.Exe,Cwd=current.Cwd,Arguments=current.Arguments,Artifact=current.Artifact }; }
  void Match(Claim c) { var a=CurrentClaim();if(c==null||c.Generation!=a.Generation||c.Pid!=a.Pid||c.Birth!=a.Birth||c.Exe!=a.Exe||c.Cwd!=a.Cwd||c.Arguments!=a.Arguments||c.Artifact!=a.Artifact)throw new InvalidOperationException("WEB_CLAIM_CHANGED"); }
  public Lease Begin(Claim claim,int ttlMs) {
   Host();if(ttlMs<1||ttlMs>60000)throw new InvalidOperationException("WEB_LEASE_DURATION");
   if(!gate.Wait(0))throw new InvalidOperationException("WEB_WRITER_BUSY");Lease l=null;
   try { Match(claim);l=new Lease { Owner=this,Generation=generation,Deadline=Clock+(long)(ttlMs*(double)Stopwatch.Frequency/1000),Id=Guid.NewGuid().ToString("N") };
    foreach(var p in pins) { NoReparse(p.Key);var f=new FileStream(p.Key,FileMode.Open,FileAccess.Read,FileShare.Read);l.Held.Add(f);var h=Hash(Bytes(f));if(h!=p.Value)throw new InvalidOperationException("WEB_PIN_CHANGED");l.Hashes.Add(p.Key,h); }
    var state=new FileStream(control,FileMode.Open,FileAccess.ReadWrite,FileShare.Read);l.Held.Add(state);l.Before=Bytes(state);l.ControlHash=Hash(l.Before);
    active=l;old=current;candidate=null;phase="Prepared";Guard(l);return l;
   } catch { if(l!=null)foreach(var f in l.Held)f.Dispose();active=null;gate.Release();throw; }
  }
  void Guard(Lease l) {
   Host();if(l==null||!Object.ReferenceEquals(l.Owner,this)||!Object.ReferenceEquals(active,l)||l.Closed||l.Generation!=generation||Clock>l.Deadline)throw new InvalidOperationException("WEB_STALE_LEASE");
   for(int i=0;i<l.Held.Count-1;i++) { var f=l.Held[i];NoReparse(f.Name);if(Hash(Bytes(f))!=l.Hashes[f.Name])throw new InvalidOperationException("WEB_PIN_CHANGED"); }
   var state=l.Held[l.Held.Count-1];if(Hash(Bytes(state))!=l.ControlHash)throw new InvalidOperationException("WEB_PUBLICATION_CHANGED");
   if(Hash(preservedBoundary())!=pins[protection])throw new InvalidOperationException("WEB_PRESERVED_BOUNDARY_CHANGED");
   if(Clock>l.Deadline)throw new InvalidOperationException("WEB_STALE_LEASE");
  }
  void Ready(Lease l,Child child) {
   Guard(l);child.Verify();if(fixture)return;
   // In the real host, birth alone is not readiness. This branch is not run by
   // offline fixtures and cannot be reached through the closed PS entry point.
   string package=child.Artifact=="b89+CSSb6"?CandidateRoot:RollbackRoot;
   string html=Path.Combine(package,"apps","sites-workflow","dist","legacy-admin.html"),expected;
   if(!pins.TryGetValue(html,out expected))throw new InvalidOperationException("WEB_READY_PIN_MISSING");
   for(int attempt=0;attempt<20;attempt++) {
    Guard(l);child.Verify();
    try {
     Kernel.AssertFixedWebListener(child.Pid);
     var q=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:5244/legacy-admin.html");q.Proxy=null;q.AllowAutoRedirect=false;q.Timeout=2000;q.ReadWriteTimeout=2000;q.AutomaticDecompression=DecompressionMethods.None;q.Headers[HttpRequestHeader.AcceptEncoding]="identity";
     using(var response=(HttpWebResponse)q.GetResponse())using(var input=response.GetResponseStream())using(var memory=new MemoryStream()) {
      if(response.StatusCode!=HttpStatusCode.OK)throw new InvalidOperationException("WEB_READY_STATUS");
      byte[] b=new byte[8192];int read;while((read=input.Read(b,0,b.Length))>0){memory.Write(b,0,read);if(memory.Length>1048576)throw new InvalidOperationException("WEB_READY_LENGTH");}
      if(Hash(memory.ToArray())!=expected)throw new InvalidOperationException("WEB_SERVED_BYTES_CHANGED");
     }
     Guard(l);child.Verify();Kernel.AssertFixedWebListener(child.Pid);return;
    }catch(WebException){Thread.Sleep(100);}
    catch(InvalidOperationException e){if(e.Message!="WEB_PORT_NOT_READY")throw;Thread.Sleep(100);}
   }
   throw new InvalidOperationException("WEB_READY_NOT_CONFIRMED");
  }
  public void Validate(Lease l,Claim expected) { Guard(l);Match(expected); }
  public void StopOld(Lease l) { Guard(l);if(phase!="Prepared")throw new InvalidOperationException("WEB_PHASE");old.Verify();Guard(l);old.Stop();phase="OldRetired"; }
  public void StartCandidate(Lease l) { Guard(l);if(phase!="OldRetired"||!old.Exited)throw new InvalidOperationException("WEB_PHASE");candidate=Birth(candidateEntry,"candidate");phase="CandidateStarted"; }
  void Publish(Lease l,string artifact) { Guard(l);Ready(l,current);Guard(l);var s=l.Held[l.Held.Count-1];var b=Encoding.UTF8.GetBytes(artifact+"\n"+l.Id+"\n"+generation);s.Position=0;s.Write(b,0,b.Length);s.SetLength(b.Length);s.Flush(true);l.ControlHash=Hash(b); }
  public Outcome PublishCandidate(Lease l) { Guard(l);if(phase!="CandidateStarted")throw new InvalidOperationException("WEB_PHASE");candidate.Verify();if(!old.Exited)throw new InvalidOperationException("WEB_OLD_NOT_RETIRED");current=candidate;Publish(l,current.Artifact);phase="CandidatePublishedOldRetiredAwaitingAck";return Pending(l); }
  public Outcome Rollback(Lease l) {
   Guard(l);if(phase!="OldRetired"&&phase!="CandidateStarted"&&phase!="CandidatePublishedOldRetiredAwaitingAck")throw new InvalidOperationException("WEB_PHASE");
   if(candidate!=null&&!candidate.Exited){candidate.Verify();Guard(l);candidate.Stop();}
   Guard(l);if(!old.Exited)throw new InvalidOperationException("WEB_OLD_NOT_RETIRED");current=Birth(rollbackEntry,"rollback");Publish(l,current.Artifact);phase="RollbackPublishedAwaitingAck";return Pending(l);
  }
  public Outcome Pending(Lease l) { Guard(l);return new Outcome { TransitionId=l.Id,State=phase,Artifact=current.Artifact,Generation=generation,Pid=current.Pid,OldRetired=old.Exited,FinalAcknowledged=false,BeforeSha256=Hash(l.Before),PublishedSha256=l.ControlHash }; }
  public Outcome Acknowledge(Lease l,string transitionId,string outcome) {
   Host();
   if(Object.ReferenceEquals(last,l)&&receipt!=null&&l.Closed&&receipt.TransitionId==transitionId&&(lastAckRequest==outcome||receipt.State==outcome)&&generation==receipt.Generation)return receipt;
   Guard(l);if(l.Id!=transitionId||phase!=outcome||(phase!="CandidatePublishedOldRetiredAwaitingAck"&&phase!="RollbackPublishedAwaitingAck"))throw new InvalidOperationException("WEB_ACK_MISMATCH");
   Ready(l,current);if(!old.Exited)throw new InvalidOperationException("WEB_OLD_NOT_RETIRED");Guard(l);
   receipt=Pending(l);lastAckRequest=outcome;
   string final=phase=="CandidatePublishedOldRetiredAwaitingAck"?"CandidateCommittedOldRetired":"RollbackRestored";
   Guard(l);var state=l.Held[l.Held.Count-1];var bytes=Encoding.UTF8.GetBytes(current.Artifact+"\n"+l.Id+"\n"+(generation+1)+"\nACK:"+final);
   state.Position=0;state.Write(bytes,0,bytes.Length);state.SetLength(bytes.Length);state.Flush(true);l.ControlHash=Hash(bytes);
   generation++;receipt.Generation=generation;receipt.State=final;receipt.PublishedSha256=l.ControlHash;receipt.FinalAcknowledged=true;
   l.Closed=true;last=l;active=null;foreach(var f in l.Held)f.Dispose();phase="Owned";gate.Release();return receipt;
  }
  // A real cooperating writer uses this SAME semaphore, not a caller flag.
  // Expired/unacknowledged transitions retain it; no automatic writer resume.
  public bool TryCooperatingWriter() { Host();if(!gate.Wait(0))return false;try { current.Verify();generation++;File.AppendAllText(control,"writer\n");return true; }finally{gate.Release();} }
  public string State { get { return phase; } }
  public Outcome ReadOutcome(Lease l){Host();if(Object.ReferenceEquals(last,l)&&receipt!=null&&l.Closed&&receipt.Generation==generation)return receipt;return Pending(l);}
  public void RequestFixtureCandidateExit() { if(!fixture||candidate==null)throw new InvalidOperationException("WEB_FIXTURE_SCOPE");candidate.Process.StandardInput.WriteLine("exit");candidate.Process.StandardInput.Flush();if(!candidate.Process.WaitForExit(5000))throw new InvalidOperationException("WEB_FIXTURE_EXIT"); }
  // Fixture teardown is not runtime recovery. Only the restrictive temp factory
  // can create this public object; retained handles never target other PIDs.
  public void Dispose() {
   if(disposed)return;
   // Production loss/timeout is not a license to stop or resume anything. Only
   // the explicit restrictive fixture factory gets emergency test cleanup.
   if(!fixture)throw new InvalidOperationException("WEB_OWNER_REQUIRES_FINAL_ACK_OR_MANUAL_RECOVERY");
   disposed=true;foreach(var c in born){try{if(!c.Exited)Kernel.Stop(c.Handle,c.Birth);}finally{c.Dispose();}}
   if(active!=null){foreach(var f in active.Held)f.Dispose();active.Closed=true;active=null;gate.Release();}foreach(var f in birthPins)f.Dispose();gate.Dispose();
  }
 }
 public static class Consumer {
  public static Outcome Commit(Owner owner,Lease lease,Claim claim) { owner.Validate(lease,claim);owner.StopOld(lease);owner.StartCandidate(lease);var p=owner.PublishCandidate(lease);return owner.Acknowledge(lease,p.TransitionId,p.State); }
  public static Outcome Recover(Owner owner,Lease lease) { var p=owner.Rollback(lease);return owner.Acknowledge(lease,p.TransitionId,p.State); }
 }
}
