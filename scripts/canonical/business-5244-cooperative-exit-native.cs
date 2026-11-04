using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

// Query-only identity and immutable source seals. No terminate, adoption,
// mutex acquisition, network, ACL, credential or installation capability.
public sealed class Business5244CooperativeExitSeal : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct Unicode { public ushort Length, Maximum; public IntPtr Buffer; }
 [StructLayout(LayoutKind.Sequential)] struct Info { public uint attrs,c0,c1,a0,a1,w0,w1,volume,sizeHigh,sizeLow,links,indexHigh,indexLow; }
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
 [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr h,out long birth,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h,int flags,StringBuilder value,ref int size);
 [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr h,int kind,IntPtr data,int size,out int needed);
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CommandLineToArgvW(string text,out int count);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
 [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr h,uint access,out IntPtr token);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string path,uint access,uint share,IntPtr security,uint mode,uint flags,IntPtr template);
 [DllImport("kernel32.dll")] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern uint GetFinalPathNameByHandle(SafeFileHandle h,StringBuilder path,uint capacity,uint flags);
 readonly int ownerPid,thread,runspace,clientPid;
 readonly long ownerBirth,clientBirth;
 readonly string sid,exe;
 readonly string[] ownerArgs,clientArgs;
 readonly Dictionary<string,FileStream> sources=new Dictionary<string,FileStream>(StringComparer.OrdinalIgnoreCase);
 readonly Dictionary<string,string> hashes=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
 sealed class DirectoryPin { public SafeFileHandle Handle; public string Path; public Info Identity; }
 readonly List<DirectoryPin> directories=new List<DirectoryPin>();
 IntPtr client; bool disposed,sourcesReleased;
 static Exception Error(string code) { return new InvalidOperationException("COOPERATIVE_EXIT_"+code); }
 static long Birth(IntPtr h) { long b,e,k,u; if(h==IntPtr.Zero||!GetProcessTimes(h,out b,out e,out k,out u))throw Error("BIRTH_UNKNOWN");return b; }
 static string Sid(IntPtr h) { IntPtr t;if(!OpenProcessToken(h,8,out t))throw Error("SID_UNKNOWN");try{using(var i=new WindowsIdentity(t))return i.User.Value;}finally{CloseHandle(t);} }
 static string Image(IntPtr h) { int n=32768;var s=new StringBuilder(n);if(!QueryFullProcessImageName(h,0,s,ref n))throw Error("IMAGE_UNKNOWN");return s.ToString(); }
 static string[] Args(IntPtr h) {
  int n;NtQueryInformationProcess(h,60,IntPtr.Zero,0,out n);if(n<Marshal.SizeOf(typeof(Unicode))||n>262144)throw Error("ARGV_UNKNOWN");
  int capacity=n;IntPtr b=Marshal.AllocHGlobal(n),a=IntPtr.Zero;
  try{if(NtQueryInformationProcess(h,60,b,n,out n)!=0)throw Error("ARGV_UNKNOWN");var s=(Unicode)Marshal.PtrToStructure(b,typeof(Unicode));if(s.Length%2!=0||s.Length>s.Maximum||s.Buffer.ToInt64()<b.ToInt64()+Marshal.SizeOf(typeof(Unicode))||s.Buffer.ToInt64()+s.Length>b.ToInt64()+capacity)throw Error("ARGV_UNKNOWN");int count;a=CommandLineToArgvW(Marshal.PtrToStringUni(s.Buffer,s.Length/2),out count);if(a==IntPtr.Zero||count<5||count>32)throw Error("ARGV_UNKNOWN");var result=new string[count];for(int i=0;i<count;i++)result[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(a,i*IntPtr.Size));return result;}finally{if(a!=IntPtr.Zero)LocalFree(a);Marshal.FreeHGlobal(b);}
 }
 static int Runspace() {
  foreach(var a in AppDomain.CurrentDomain.GetAssemblies())if(a.GetName().Name=="System.Management.Automation"){var type=a.GetType("System.Management.Automation.Runspaces.Runspace",true);var r=type.GetProperty("DefaultRunspace").GetValue(null,null);if(r==null)throw Error("RUNSPACE_REQUIRED");return (int)type.GetProperty("Id").GetValue(r,null);}throw Error("RUNSPACE_REQUIRED");
 }
 static string Hash(FileStream f) { f.Position=0;try{using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}finally{f.Position=0;} }
 static string Final(SafeFileHandle h) { var s=new StringBuilder(32768);uint n=GetFinalPathNameByHandle(h,s,(uint)s.Capacity,0);if(n==0||n>=s.Capacity)throw Error("PATH_UNKNOWN");string p=s.ToString();return p.StartsWith(@"\\?\")?p.Substring(4):p; }
 void HoldDirectory(string path) {
  path=Path.GetFullPath(path);string parent=Path.GetDirectoryName(path);if(!String.IsNullOrEmpty(parent)&&parent!=path)HoldDirectory(parent);
  var h=CreateFile(path,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);Info info;
  if(h.IsInvalid||!GetFileInformationByHandle(h,out info)||(info.attrs&0x410)!=0x10||!String.Equals(Final(h).TrimEnd('\\'),path.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase)){h.Dispose();throw Error("DIRECTORY_REJECTED");}directories.Add(new DirectoryPin{Handle=h,Path=path,Identity=info});
 }
 void Pin(string path,string hash) {
  if(hash==null||!System.Text.RegularExpressions.Regex.IsMatch(hash,"\\A[a-f0-9]{64}\\z"))throw Error("SOURCE_HASH_REQUIRED");path=Path.GetFullPath(path);if(sources.ContainsKey(path))throw Error("DUPLICATE_SOURCE");HoldDirectory(Path.GetDirectoryName(path));
  var h=CreateFile(path,0x80000000,1,IntPtr.Zero,3,0x00200080,IntPtr.Zero);FileStream f=null;
  try{Info info;if(h.IsInvalid||!GetFileInformationByHandle(h,out info)||(info.attrs&0x410)!=0||info.links!=1||!String.Equals(Final(h),path,StringComparison.OrdinalIgnoreCase))throw Error("SOURCE_IDENTITY");f=new FileStream(h,FileAccess.Read);if(Hash(f)!=hash)throw Error("SOURCE_CHANGED");sources.Add(path,f);hashes.Add(path,hash);}catch{if(f!=null)f.Dispose();else h.Dispose();throw;}
 }
 void Match(IntPtr h,int pid,long birth,string[] expected) {
  if(Birth(h)!=birth||WaitForSingleObject(h,0)!=258||Sid(h)!=sid||!String.Equals(Image(h),exe,StringComparison.OrdinalIgnoreCase))throw Error("NATIVE_IDENTITY_CHANGED");
  var actual=Args(h);if(actual.Length!=expected.Length)throw Error("ARGV_CHANGED");for(int i=0;i<actual.Length;i++)if(actual[i]!=expected[i])throw Error("ARGV_CHANGED");
  // Entry is exactly -NoProfile -NonInteractive -File <sealed source>.
  if(expected.Length<5||!String.Equals(expected[0],exe,StringComparison.OrdinalIgnoreCase)||expected[1]!="-NoProfile"||expected[2]!="-NonInteractive"||expected[3]!="-File"||!sources.ContainsKey(expected[4]))throw Error("SEALED_FILE_ENTRY_REQUIRED");
 }
 public Business5244CooperativeExitSeal(int expectedClientPid,string expectedClientBirth,string[] expectedOwnerArgs,string[] expectedClientArgs,string[] paths,string[] sha256,string auditRoot,string pendingPath) {
  ownerPid=Process.GetCurrentProcess().Id;ownerBirth=Birth(GetCurrentProcess());thread=Thread.CurrentThread.ManagedThreadId;runspace=Runspace();sid=Sid(GetCurrentProcess());exe=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
  if(expectedClientPid<=0||expectedClientPid==ownerPid||!Int64.TryParse(expectedClientBirth,out clientBirth)||clientBirth<=0||expectedOwnerArgs==null||expectedClientArgs==null||paths==null||sha256==null||paths.Length!=sha256.Length||paths.Length<2)throw Error("FINITE_BINDING_REQUIRED");
  clientPid=expectedClientPid;ownerArgs=(string[])expectedOwnerArgs.Clone();clientArgs=(string[])expectedClientArgs.Clone();
  try{for(int i=0;i<paths.Length;i++)Pin(paths[i],sha256[i]);HoldDirectory(auditRoot);HoldDirectory(Path.GetDirectoryName(pendingPath));client=OpenProcess(0x00101000,false,clientPid);Validate();}catch{Close();throw;}
 }
 public void Validate() {
  ValidateJournal();if(sourcesReleased)throw Error("SOURCES_RELEASED");
  Match(GetCurrentProcess(),ownerPid,ownerBirth,ownerArgs);Match(client,clientPid,clientBirth,clientArgs);foreach(var p in sources)if(Hash(p.Value)!=hashes[p.Key])throw Error("SOURCE_CHANGED");
 }
 public void AssertClient(uint pid,string birth,string peerSid) { Validate();if(pid!=clientPid||birth!=clientBirth.ToString(System.Globalization.CultureInfo.InvariantCulture)||peerSid!=sid)throw Error("CLIENT_NOT_AUTHORIZED"); }
 public void ValidateJournal() {
  if(disposed||ownerPid!=Process.GetCurrentProcess().Id||ownerBirth!=Birth(GetCurrentProcess())||thread!=Thread.CurrentThread.ManagedThreadId||runspace!=Runspace())throw Error("ISSUER_CHANGED");
  foreach(var d in directories){Info i;if(d.Handle.IsClosed||!GetFileInformationByHandle(d.Handle,out i)||(i.attrs&0x410)!=0x10||i.volume!=d.Identity.volume||i.indexHigh!=d.Identity.indexHigh||i.indexLow!=d.Identity.indexLow||!String.Equals(Final(d.Handle).TrimEnd('\\'),d.Path.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw Error("DIRECTORY_CHANGED");}
 }
 public void ReleaseSources() {
  ValidateJournal();if(sourcesReleased)return;foreach(var f in sources.Values)f.Dispose();sources.Clear();if(client!=IntPtr.Zero){if(!CloseHandle(client))throw Error("CLIENT_HANDLE_CLOSE_UNKNOWN");client=IntPtr.Zero;}sourcesReleased=true;
 }
 // Normal owner cleanup may outlive the controller. Closing seals requires
 // the original owner/runspace, but does not renew an expired request.
 public void Dispose() { if(ownerPid!=Process.GetCurrentProcess().Id||ownerBirth!=Birth(GetCurrentProcess())||thread!=Thread.CurrentThread.ManagedThreadId||runspace!=Runspace())throw Error("ISSUER_CHANGED");Close(); }
 void Close() { if(disposed)return;foreach(var f in sources.Values)f.Dispose();sources.Clear();foreach(var d in directories)d.Handle.Dispose();directories.Clear();if(client!=IntPtr.Zero){if(!CloseHandle(client))throw Error("CLIENT_HANDLE_CLOSE_UNKNOWN");client=IntPtr.Zero;}disposed=true; }
}
