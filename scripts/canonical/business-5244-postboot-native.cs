using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Management;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using Microsoft.Win32.SafeHandles;

// Query/read-only identity. Case-only command spelling is accepted only when
// all three held files (argv0, expected path, actual process image) are the
// same canonical Windows file, with the pinned digest and native actor birth/SID.
public sealed class Business5244PostbootExecutable : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct Info { public uint attrs,c0,c1,a0,a1,w0,w1,volume,hi,lo,links,idHi,idLo; }
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll")] static extern uint GetCurrentProcessId();
    [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr h,out long b,out long e,out long k,out long u);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h,uint flags,StringBuilder p,ref uint size);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr h,uint access,out IntPtr token);
    [DllImport("kernel32.dll")] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info i);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern uint GetFinalPathNameByHandle(SafeFileHandle h,StringBuilder p,uint size,uint flags);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern SafeFileHandle CreateFile(string p,uint a,uint share,IntPtr sec,uint creation,uint flags,IntPtr template);
    sealed class FilePin { public FileStream Stream;public Info Identity;public string Path; }
    sealed class DirectoryPin { public SafeFileHandle Handle;public Info Identity;public string Path; }
    readonly int issuer=(int)GetCurrentProcessId(),thread=Thread.CurrentThread.ManagedThreadId;
    readonly long issuerBirth=Birth(GetCurrentProcess());readonly string issuerSid=WindowsIdentity.GetCurrent().User.Value;
    readonly List<FilePin> files=new List<FilePin>();readonly Dictionary<string,DirectoryPin> dirs=new Dictionary<string,DirectoryPin>(StringComparer.OrdinalIgnoreCase);
    IntPtr process;long actorBirth;string actorSid;bool disposed;
    static Exception Fail(string s){return new InvalidOperationException("POSTBOOT_EXECUTABLE_"+s);}
    static long Birth(IntPtr p){long b,e,k,u;if(p==IntPtr.Zero||!GetProcessTimes(p,out b,out e,out k,out u))throw Fail("BIRTH_UNAVAILABLE");return b;}
    static string Sid(IntPtr p){IntPtr t;if(!OpenProcessToken(p,8,out t))throw Fail("OWNER_UNAVAILABLE");try{using(var i=new WindowsIdentity(t))return i.User.Value;}finally{CloseHandle(t);}}
    static string Final(SafeFileHandle h){var b=new StringBuilder(32768);uint n=GetFinalPathNameByHandle(h,b,(uint)b.Capacity,0);if(n==0||n>=b.Capacity)throw Fail("PATH_UNAVAILABLE");string p=b.ToString();return p.StartsWith(@"\\?\",StringComparison.Ordinal)?p.Substring(4):p;}
    static bool Same(Info a,Info b){return a.volume==b.volume&&a.idHi==b.idHi&&a.idLo==b.idLo;}
    void PinDirectory(string p){if(String.IsNullOrEmpty(p)||dirs.ContainsKey(p))return;PinDirectory(Path.GetDirectoryName(p));var h=CreateFile(p,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);try{Info i;if(h.IsInvalid||!GetFileInformationByHandle(h,out i)||(i.attrs&0x410)!=0x10||!String.Equals(Final(h).TrimEnd('\\'),p.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw Fail("DIRECTORY_CHANGED");dirs.Add(p,new DirectoryPin{Handle=h,Identity=i,Path=p});}catch{h.Dispose();throw;}}
    FilePin PinFile(string p){p=Path.GetFullPath(p);PinDirectory(Path.GetDirectoryName(p));var f=new FileStream(p,FileMode.Open,FileAccess.Read,FileShare.Read);try{Info i;if(!GetFileInformationByHandle(f.SafeFileHandle,out i)||(i.attrs&0x410)!=0||!String.Equals(Final(f.SafeFileHandle),p,StringComparison.OrdinalIgnoreCase))throw Fail("FILE_IDENTITY_CHANGED");var pin=new FilePin{Stream=f,Identity=i,Path=p};files.Add(pin);return pin;}catch{f.Dispose();throw;}}
    public static Business5244PostbootExecutable CaptureCurrent(string invoked,string expected,string digest){return CaptureProcess((int)GetCurrentProcessId(),Birth(GetCurrentProcess()).ToString(),WindowsIdentity.GetCurrent().User.Value,invoked,expected,digest);}
    static bool BirthMatches(long actual,long wanted,bool cim){return cim?wanted%10==0&&actual/10==wanted/10:actual==wanted;}
    public static Business5244PostbootExecutable CaptureProcess(int pid,string birth,string sid,string invoked,string expected,string digest){return Capture(pid,birth,sid,invoked,expected,digest,false);}
    public static Business5244PostbootExecutable CaptureCimProcess(int pid,string birth,string sid,string invoked,string expected,string digest){return Capture(pid,birth,sid,invoked,expected,digest,true);}
    static Business5244PostbootExecutable Capture(int pid,string birth,string sid,string invoked,string expected,string digest,bool cim){
        var r=new Business5244PostbootExecutable();try{
            long wanted;if(pid<=0||!Int64.TryParse(birth,out wanted)||String.IsNullOrEmpty(sid)||String.IsNullOrEmpty(invoked)||!String.Equals(invoked,expected,StringComparison.OrdinalIgnoreCase)||!String.Equals(Path.GetFullPath(expected),expected,StringComparison.Ordinal)||!System.Text.RegularExpressions.Regex.IsMatch(digest??"",@"\A[a-f0-9]{64}\z"))throw Fail("ARGUMENT_REJECTED");
            r.process=OpenProcess(0x00101000,false,pid);r.actorBirth=Birth(r.process);r.actorSid=Sid(r.process);
            if(WaitForSingleObject(r.process,0)!=258||!BirthMatches(r.actorBirth,wanted,cim)||!String.Equals(r.actorSid,sid,StringComparison.Ordinal))throw Fail("ACTOR_CHANGED");
            var image=new StringBuilder(32768);uint size=(uint)image.Capacity;if(!QueryFullProcessImageName(r.process,0,image,ref size)||!String.Equals(image.ToString(),expected,StringComparison.OrdinalIgnoreCase))throw Fail("PROCESS_IMAGE_CHANGED");
            var a=r.PinFile(invoked);var b=r.PinFile(expected);var c=r.PinFile(image.ToString());
            if(!Same(a.Identity,b.Identity)||!Same(a.Identity,c.Identity))throw Fail("FILE_MISMATCH");
            string hash;using(var h=SHA256.Create())hash=BitConverter.ToString(h.ComputeHash(b.Stream)).Replace("-","").ToLowerInvariant();b.Stream.Position=0;if(hash!=digest)throw Fail("HASH_CHANGED");r.Validate();return r;
        }catch{r.Dispose();throw;}
    }
    public void Validate(){
        if(disposed||issuer!=(int)GetCurrentProcessId()||thread!=Thread.CurrentThread.ManagedThreadId||issuerBirth!=Birth(GetCurrentProcess())||issuerSid!=WindowsIdentity.GetCurrent().User.Value)throw Fail("ISSUER_CHANGED");
        if(process==IntPtr.Zero||WaitForSingleObject(process,0)!=258||Birth(process)!=actorBirth||Sid(process)!=actorSid)throw Fail("ACTOR_CHANGED");
        foreach(var p in files){Info i;if(p.Stream.SafeFileHandle.IsClosed||!GetFileInformationByHandle(p.Stream.SafeFileHandle,out i)||!Same(i,p.Identity)||(i.attrs&0x410)!=0||!String.Equals(Final(p.Stream.SafeFileHandle),p.Path,StringComparison.OrdinalIgnoreCase))throw Fail("FILE_IDENTITY_CHANGED");}
        foreach(var p in dirs.Values){Info i;if(p.Handle.IsClosed||!GetFileInformationByHandle(p.Handle,out i)||!Same(i,p.Identity)||(i.attrs&0x410)!=0x10||!String.Equals(Final(p.Handle).TrimEnd('\\'),p.Path.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw Fail("DIRECTORY_CHANGED");}
    }
    public void Dispose(){if(disposed)return;foreach(var p in files)p.Stream.Dispose();foreach(var p in dirs.Values)p.Handle.Dispose();if(process!=IntPtr.Zero){CloseHandle(process);process=IntPtr.Zero;}disposed=true;}
}

// A new boot is a precondition, never evidence of normal cleanup. This class
// cannot stop/start a process or change SQL/tasks. Only its OWN newly created
// barrier can become a retained completion witness after explicit finalization.
public sealed class Business5244PostbootEpoch : IDisposable {
    const string PrivateRoot = @"C:\Sirket\ERP\evidence\ERP-GREEN-5244-REALDATA-COMPAT-PREP-20261027\private\b6-postboot-profile-integration-20261102-0742";
    const string Runtime = @"C:\Sirket\ERP\runtime\UNIFIED-5244-SEMIH-20261027";
    const string RecordDirectory = @"C:\Sirket\ERP\clean\20261022\runtime";
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr h, out long b, out long e, out long k, out long u);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateDirectoryW(string p, IntPtr s);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern SafeFileHandle CreateFile(string p,uint a,uint s,IntPtr sec,uint c,uint f,IntPtr t);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern uint GetFinalPathNameByHandle(SafeFileHandle h,StringBuilder b,uint n,uint flags);
    [DllImport("kernel32.dll")] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info i);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a,bool inherit,int pid);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h,uint ms);
    [DllImport("kernel32.dll")] static extern ulong GetTickCount64();
    [DllImport("shell32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CommandLineToArgvW(string text,out int n);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr h);
    [DllImport("kernelbase.dll",SetLastError=true)] static extern bool CompareObjectHandles(IntPtr a,IntPtr b);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetFileInformationByHandle(SafeFileHandle h,int kind,IntPtr data,uint length);
    [StructLayout(LayoutKind.Sequential)] struct Info { public uint attrs,c0,c1,a0,a1,w0,w1,volume,sizeHigh,sizeLow,links,indexHigh,indexLow; }
    readonly int pid=Process.GetCurrentProcess().Id, thread=Thread.CurrentThread.ManagedThreadId;
    readonly string sid=WindowsIdentity.GetCurrent().User.Value;
    readonly long birth, boot;
    readonly bool steady;
    long namespaceBirth;
    readonly ulong issuedUptime=GetTickCount64();
    readonly Dictionary<string,FileStream> records=new Dictionary<string,FileStream>(StringComparer.Ordinal);
    sealed class ExtraDirectory { public SafeFileHandle Handle; public Info Identity;public string Path; }
    readonly List<ExtraDirectory> extraDirectories=new List<ExtraDirectory>();
    sealed class Actor { public IntPtr Handle;public int Pid;public long Birth; }
    readonly Dictionary<string,Actor> actors=new Dictionary<string,Actor>(StringComparer.Ordinal);
    FileStream pending;Info pendingIdentity;string pendingHash;
    bool pendingDirectoryHeld;
    bool pendingAttempted,pendingKnown,barrierCompleted;
    SafeFileHandle directory; Info directoryIdentity; string directoryPath;
    Mutex lease; bool held, disposed, attempted; object child; IntPtr childObservation;
    string childBirth; int childPid;
    IntPtr parent;long parentBirth;
    string stage="Prepared";
    string claimedRole;
    string failedRecord;
    static Exception Error(string code) { return new InvalidOperationException("POSTBOOT_"+code); }
    static long Birth(IntPtr h) { long b,e,k,u;if(h==IntPtr.Zero||!GetProcessTimes(h,out b,out e,out k,out u))throw Error("NATIVE_BIRTH_UNAVAILABLE");return b; }
    public static string CurrentBirth { get { return Birth(GetCurrentProcess()).ToString(System.Globalization.CultureInfo.InvariantCulture); } }
    public static string BootFileTime() {
        using(var q=new ManagementObjectSearcher("SELECT LastBootUpTime FROM Win32_OperatingSystem"))
        using(var rows=q.Get()) {
            if(rows.Count!=1)throw Error("BOOT_UNAVAILABLE");
            foreach(ManagementObject row in rows) return ManagementDateTimeConverter.ToDateTime((string)row["LastBootUpTime"]).ToUniversalTime().ToFileTimeUtc().ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
        throw Error("BOOT_UNAVAILABLE");
    }
    public Business5244PostbootEpoch(string priorBoot,string capturedUtc):this(priorBoot,capturedUtc,false) {}
    public Business5244PostbootEpoch(string priorBoot,string capturedUtc,bool steadyMode) {
        long prior,capture;
        if(!Int64.TryParse(priorBoot,out prior)||!Int64.TryParse(capturedUtc,out capture)||prior<=0||capture<prior)throw Error("BASELINE_INVALID");
        birth=Birth(GetCurrentProcess());boot=Int64.Parse(BootFileTime(),System.Globalization.CultureInfo.InvariantCulture);
        if(boot==prior||boot<=capture||birth<boot||boot>DateTime.UtcNow.ToFileTimeUtc())throw Error("NEW_BOOT_REQUIRED");
        steady=steadyMode;namespaceBirth=birth;
    }
    public string Boot { get { Validate();return boot.ToString(System.Globalization.CultureInfo.InvariantCulture); } }
    public string Stage { get { Validate();return stage; } }
    public string ClaimedRole { get { Validate();return claimedRole; } }
    public void Validate() {
        if(disposed||pid!=Process.GetCurrentProcess().Id||thread!=Thread.CurrentThread.ManagedThreadId||birth!=Birth(GetCurrentProcess())||sid!=WindowsIdentity.GetCurrent().User.Value||GetTickCount64()<issuedUptime)throw Error("ISSUER_OR_EPOCH_CHANGED");
        if(parent!=IntPtr.Zero&&(WaitForSingleObject(parent,0)!=258||Birth(parent)!=parentBirth))throw Error("TASK_HOST_EXITED_OR_CHANGED");
        if(directory!=null)CheckDirectory();
        foreach(var d in extraDirectories){Info i;if(d.Handle.IsInvalid||d.Handle.IsClosed||!GetFileInformationByHandle(d.Handle,out i)||(i.attrs&0x410)!=0x10||i.volume!=d.Identity.volume||i.indexHigh!=d.Identity.indexHigh||i.indexLow!=d.Identity.indexLow||Final(d.Handle)!=d.Path)throw Error("PENDING_DIRECTORY_CHANGED");}
        if(pending!=null){Info i;string expected=barrierCompleted?directoryPath+"\\postboot-successor.completed":Runtime+"\\5244-retirement.pending";if(pending.SafeFileHandle.IsClosed||!GetFileInformationByHandle(pending.SafeFileHandle,out i)||(i.attrs&0x410)!=0||i.links!=1||i.volume!=pendingIdentity.volume||i.indexHigh!=pendingIdentity.indexHigh||i.indexLow!=pendingIdentity.indexLow||Final(pending.SafeFileHandle)!=expected)throw Error("PENDING_IDENTITY_CHANGED");if(pendingKnown){long position=pending.Position;try{pending.Position=0;using(var m=new MemoryStream()){pending.CopyTo(m);if(Hash(m.ToArray())!=pendingHash)throw Error("PENDING_CONTENT_CHANGED");}}finally{pending.Position=position;}}if(barrierCompleted&&File.Exists(Runtime+"\\5244-retirement.pending"))throw Error("PENDING_REAPPEARED");}
    }
    static string Final(SafeFileHandle h) { var b=new StringBuilder(32768);uint n=GetFinalPathNameByHandle(h,b,(uint)b.Capacity,0);if(n==0||n>=b.Capacity)throw Error("PATH_UNAVAILABLE");string p=b.ToString();return p.StartsWith(@"\\?\")?p.Substring(4):p; }
    void CheckDirectory() {
        Info i;if(directory.IsClosed||directory.IsInvalid||!GetFileInformationByHandle(directory,out i)||(i.attrs&0x410)!=0x10||i.volume!=directoryIdentity.volume||i.indexHigh!=directoryIdentity.indexHigh||i.indexLow!=directoryIdentity.indexLow||Final(directory)!=directoryPath)throw Error("ONCE_IDENTITY_CHANGED");
    }
    public void BindTaskHost(int hostPid) { Validate();if(parent!=IntPtr.Zero||hostPid<=0||hostPid==pid||directory!=null)throw Error("TASK_HOST_BINDING_REJECTED");parent=OpenProcess(0x00101000,false,hostPid);if(parent==IntPtr.Zero||WaitForSingleObject(parent,0)!=258)throw Error("TASK_HOST_UNAVAILABLE");parentBirth=Birth(parent);namespaceBirth=parentBirth; }
    public void BindOrValidateActor(string name,int actorPid,string cimBirth) {
        Validate();long expected;if((name!="web5194"&&name!="native4146"&&name!="api4144")||actorPid<=0||!Int64.TryParse(cimBirth,out expected))throw Error("PROTECTED_ACTOR_REJECTED");
        Actor a;if(actors.TryGetValue(name,out a)){if(a.Pid!=actorPid||Math.Abs(a.Birth-expected)>9||WaitForSingleObject(a.Handle,0)!=258||Birth(a.Handle)!=a.Birth)throw Error("PROTECTED_ACTOR_CHANGED");return;}
        IntPtr h=OpenProcess(0x00101000,false,actorPid);try{long actual=Birth(h);if(WaitForSingleObject(h,0)!=258||Math.Abs(actual-expected)>9)throw Error("PROTECTED_ACTOR_CHANGED");actors.Add(name,new Actor{Handle=h,Pid=actorPid,Birth=actual});h=IntPtr.Zero;}finally{if(h!=IntPtr.Zero)CloseHandle(h);}
    }
    public void HoldPendingDirectory() {
        ValidateLease();HoldDirectoryTree(Runtime);pendingDirectoryHeld=true;
    }
    public void HoldRecordDirectory() { ValidateLease();HoldDirectoryTree(RecordDirectory); }
    void HoldDirectoryTree(string target) {
        for(string p=target;p!=null;p=Path.GetDirectoryName(p)){
            bool exists=false;foreach(var d in extraDirectories)if(d.Path.TrimEnd('\\')==p.TrimEnd('\\')){exists=true;break;}if(exists)continue;
            var h=CreateFile(p,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);Info i;
            if(h.IsInvalid||!GetFileInformationByHandle(h,out i)||(i.attrs&0x410)!=0x10||Final(h).TrimEnd('\\')!=p.TrimEnd('\\')){h.Dispose();throw Error("PENDING_DIRECTORY_REJECTED");}
            extraDirectories.Add(new ExtraDirectory{Handle=h,Identity=i,Path=Final(h)});
        }
    }
    public FileStream CreatePending(byte[] bytes) {
        ValidateLease();if(steady||!pendingDirectoryHeld||pendingAttempted||directory==null||claimedRole!="web"||(stage!="Promoting"&&stage!="RollingBack"&&stage!="Finalizing")||bytes==null||bytes.Length==0||bytes.Length>32768)throw Error("PENDING_BINDING_REJECTED");pendingAttempted=true;
        var h=CreateFile(Runtime+"\\5244-retirement.pending",0xc0010000,1,IntPtr.Zero,1,0x00200080,IntPtr.Zero);
        if(h.IsInvalid){h.Dispose();throw Error("PENDING_CREATE_UNCONFIRMED");}
        pending=new FileStream(h,FileAccess.ReadWrite);if(!GetFileInformationByHandle(h,out pendingIdentity))throw Error("PENDING_IDENTITY_UNAVAILABLE");
        pending.Write(bytes,0,bytes.Length);pending.Flush(true);pending.Position=0;var actual=new byte[bytes.Length];if(pending.Read(actual,0,actual.Length)!=actual.Length||Hash(actual)!=Hash(bytes))throw Error("PENDING_NOT_DURABLE");pendingHash=Hash(bytes);pendingKnown=true;Validate();return pending;
    }
    public string PendingSha256 { get { ValidateLease();if(!pendingKnown)throw Error("PENDING_UNKNOWN");return pendingHash; } }
    public void BeginFinalize() {
        ValidateLease();if(steady||attempted||(stage!="OldReady"&&stage!="CandidateReady"&&stage!="RollbackReady"))throw Error("FINALIZE_STAGE_REJECTED");stage="Finalizing";attempted=true;
    }
    public void CompleteOwnBarrier() {
        ValidateLease();if(stage!="Finalizing"||!attempted||!pendingKnown||pending==null||barrierCompleted||directoryIdentity.volume!=pendingIdentity.volume)throw Error("FINALIZE_BARRIER_REJECTED");
        string target=directoryPath+"\\postboot-successor.completed";byte[] name=Encoding.Unicode.GetBytes(target);int pointer=IntPtr.Size==8?8:4,length=pointer+IntPtr.Size,start=length+4;IntPtr buffer=Marshal.AllocHGlobal(start+name.Length+2);
        try{for(int i=0;i<start+name.Length+2;i++)Marshal.WriteByte(buffer,i,0);Marshal.WriteInt32(buffer,length,name.Length);Marshal.Copy(name,0,IntPtr.Add(buffer,start),name.Length);if(!SetFileInformationByHandle(pending.SafeFileHandle,3,buffer,(uint)(start+name.Length+2)))throw Error("FINALIZE_RENAME_UNCONFIRMED");barrierCompleted=true;Validate();pending=RetainReadOnly(target,pending,pendingIdentity,pendingHash);Validate();}finally{Marshal.FreeHGlobal(buffer);}
    }
    public void CommitFinalization() { ValidateLease();if(stage!="Finalizing"||!barrierCompleted||!records.ContainsKey("finalize-receipt.json"))throw Error("FINALIZE_RECEIPT_REQUIRED");stage="Committed";attempted=false; }
    public void Claim(string role) {
        Validate();if(directory!=null||(role!="services"&&role!="web"))throw Error("ONCE_ROLE_REJECTED");
        // Fixed new namespace. No existing once, archive or lease is reset.
        directoryPath=PrivateRoot+"\\"+(steady?"steady-"+boot+"-"+namespaceBirth+"-":"")+role+"-once";
        for(string p=PrivateRoot;p!=null;p=Path.GetDirectoryName(p))if((File.GetAttributes(p)&FileAttributes.ReparsePoint)!=0)throw Error("REPARSE_REJECTED");
        if(!CreateDirectoryW(directoryPath,IntPtr.Zero))throw Error("ONCE_ALREADY_USED_OR_UNAVAILABLE");
        directory=CreateFile(directoryPath,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
        if(directory.IsInvalid||!GetFileInformationByHandle(directory,out directoryIdentity))throw Error("ONCE_HOLD_UNAVAILABLE");CheckDirectory();claimedRole=role;
    }
    public string WriteNew(string leaf,byte[] bytes) {
        Validate();if(directory==null||bytes==null||bytes.Length>4194304||!System.Text.RegularExpressions.Regex.IsMatch(leaf,@"\A(?:claim|old-ready|candidate-ready|rollback-ready|steady-ready|promote-intent|rollback-intent|finalize-intent|finalize-receipt|promotion-failed|result|unknown|old-metadata-before|candidate-metadata-before|rollback-metadata-before|steady-metadata-before|old-metadata-after|candidate-metadata-after|rollback-metadata-after|steady-metadata-after)\.(?:json|bin)\z"))throw Error("RECORD_SCOPE_REJECTED");
        CheckDirectory();var f=new FileStream(Path.Combine(directoryPath,leaf),FileMode.CreateNew,FileAccess.ReadWrite,FileShare.Read);
        try { f.Write(bytes,0,bytes.Length);f.Flush(true);f.Position=0;var actual=new byte[bytes.Length];if(f.Read(actual,0,actual.Length)!=actual.Length)throw Error("RECORD_NOT_DURABLE");string expected=Hash(bytes);if(Hash(actual)!=expected)throw Error("RECORD_NOT_DURABLE");Info identity;if(!GetFileInformationByHandle(f.SafeFileHandle,out identity))throw Error("RECORD_IDENTITY_UNAVAILABLE");f=RetainReadOnly(Path.Combine(directoryPath,leaf),f,identity,expected);CheckDirectory();records.Add(leaf,f);return expected; } catch { failedRecord=leaf;f.Dispose();throw; }
    }
    static string Hash(byte[] b) { using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant(); }
    FileStream RetainReadOnly(string path,FileStream writer,Info identity,string expectedHash) {
        writer.Dispose();var h=CreateFile(path,0x80000000,1,IntPtr.Zero,3,0x00200080,IntPtr.Zero);Info i;
        if(h.IsInvalid||!GetFileInformationByHandle(h,out i)||(i.attrs&0x410)!=0||i.links!=1||i.volume!=identity.volume||i.indexHigh!=identity.indexHigh||i.indexLow!=identity.indexLow||Final(h)!=path){h.Dispose();throw Error("RECORD_REOPEN_IDENTITY_CHANGED");}
        var read=new FileStream(h,FileAccess.Read);try{using(var m=new MemoryStream()){read.CopyTo(m);read.Position=0;if(Hash(m.ToArray())!=expectedHash)throw Error("RECORD_REOPEN_CONTENT_CHANGED");}return read;}catch{read.Dispose();throw;}
    }
    public void BindLease(Mutex value,string name) {
        Validate();if(lease!=null||value==null||value.SafeWaitHandle.IsClosed||value.SafeWaitHandle.IsInvalid)throw Error("LEASE_REQUIRED");
        // The caller must first validate its genuine standard Owner token. This
        // additional same-thread acquisition remains held through all children.
        string expected="Global\\MelisaERP5244Startup-"+sid+"-"+Hash(Encoding.UTF8.GetBytes(Runtime.ToLowerInvariant()));if(name!=expected)throw Error("LEASE_NAME_REJECTED");
        Mutex own=Mutex.OpenExisting(name);
        try { if(!CompareObjectHandles(own.SafeWaitHandle.DangerousGetHandle(),value.SafeWaitHandle.DangerousGetHandle()))throw Error("LEASE_OBJECT_CHANGED");try{if(!own.WaitOne(0))throw Error("LEASE_BUSY");}catch(AbandonedMutexException){own.ReleaseMutex();throw Error("ABANDONED_LEASE");}lease=own;held=true; }catch{own.Dispose();throw;}
    }
    public void ValidateLease() { Validate();if(!held||lease==null||lease.SafeWaitHandle.IsClosed||lease.SafeWaitHandle.IsInvalid)throw Error("LEASE_LOST");try{if(!lease.WaitOne(0))throw Error("LEASE_LOST");lease.ReleaseMutex();}catch(AbandonedMutexException){lease.ReleaseMutex();throw Error("ABANDONED_LEASE");} }
    public void BindChild(object value) {
        ValidateLease();if(child!=null||value==null||value.GetType().FullName!="Business5244WebNative"||!value.GetType().IsSealed)throw Error("CREATED_CHILD_REQUIRED");child=value;
    }
    public void ObserveCreatedChild(object value) {
        ValidateLease();if(!Object.ReferenceEquals(child,value)||childObservation!=IntPtr.Zero)throw Error("CREATED_CHILD_CHANGED");
        childPid=(int)value.GetType().GetProperty("ChildPid").GetValue(value,null);childBirth=(string)value.GetType().GetProperty("ChildBirth").GetValue(value,null);
        childObservation=OpenProcess(0x00101000,false,childPid);
        if(childObservation==IntPtr.Zero||Birth(childObservation).ToString(System.Globalization.CultureInfo.InvariantCulture)!=childBirth||WaitForSingleObject(childObservation,0)!=258)throw Error("CREATION_OBSERVATION_UNAVAILABLE");
    }
    public void Ready(object value) {
        ValidateLease();if(!Object.ReferenceEquals(child,value)||childObservation==IntPtr.Zero||WaitForSingleObject(childObservation,0)!=258)throw Error("READY_CHILD_REQUIRED");
        if(stage=="Prepared")stage=steady?"SteadyReady":"OldReady";else if(stage=="Promoting")stage="CandidateReady";else if(stage=="RollingBack")stage="RollbackReady";else throw Error("READY_STAGE_REJECTED");
    }
    public void BeginSuccessor(string action) {
        ValidateLease();if(steady||attempted||child==null||childObservation==IntPtr.Zero||WaitForSingleObject(childObservation,0)!=258)throw Error("SUCCESSOR_ONCE_REJECTED");
        if(action=="Promote"&&stage=="OldReady")stage="Promoting";else if(action=="Rollback"&&stage=="CandidateReady")stage="RollingBack";else throw Error("SUCCESSOR_STAGE_REJECTED");attempted=true;
    }
    public void ConfirmOldChildClosed(object value) {
        ValidateLease();if(!attempted||!Object.ReferenceEquals(child,value)||childObservation==IntPtr.Zero||WaitForSingleObject(childObservation,0)!=0||!(bool)value.GetType().GetProperty("RetirementConfirmed").GetValue(value,null))throw Error("OWN_CHILD_CLEANUP_UNCONFIRMED");
        CloseHandle(childObservation);childObservation=IntPtr.Zero;child=null;
    }
    public void AdmitRollbackAfterFailedCandidate(object value) {
        ValidateLease();if((stage!="Promoting"&&!(stage=="CandidateReady"&&failedRecord=="candidate-ready.json"))||!attempted||!Object.ReferenceEquals(child,value)||childObservation==IntPtr.Zero||WaitForSingleObject(childObservation,0)!=0||!(bool)value.GetType().GetProperty("RetirementConfirmed").GetValue(value,null))throw Error("FAILED_CANDIDATE_CLEANUP_UNCONFIRMED");
        CloseHandle(childObservation);childObservation=IntPtr.Zero;child=null;stage="RollingBack";
    }
    public void EndSuccessor() { ValidateLease();if(!attempted||(stage!="CandidateReady"&&stage!="RollbackReady"))throw Error("SUCCESSOR_NOT_READY");attempted=false; }
    public static string[] SplitArguments(string text) { int n;IntPtr p=CommandLineToArgvW(text,out n);if(p==IntPtr.Zero||n<1||n>32)throw Error("ARGV_UNAVAILABLE");try{var a=new string[n];for(int i=0;i<n;i++)a[i]=Marshal.PtrToStringUni(Marshal.ReadIntPtr(p,i*IntPtr.Size));return a;}finally{LocalFree(p);} }
    public void Dispose() {
        if(disposed)return;
        if(pid!=Process.GetCurrentProcess().Id||thread!=Thread.CurrentThread.ManagedThreadId||birth!=Birth(GetCurrentProcess()))throw Error("DISPOSE_ISSUER_CHANGED");
        if(childObservation!=IntPtr.Zero){if(WaitForSingleObject(childObservation,0)!=0||child==null||!(bool)child.GetType().GetProperty("RetirementConfirmed").GetValue(child,null))throw Error("LIVE_CHILD_CLEANUP_REQUIRED");CloseHandle(childObservation);childObservation=IntPtr.Zero;}
        if(parent!=IntPtr.Zero){CloseHandle(parent);parent=IntPtr.Zero;}
        foreach(var a in actors.Values)CloseHandle(a.Handle);actors.Clear();
        foreach(var f in records.Values)f.Dispose();records.Clear();if(pending!=null)pending.Dispose();if(directory!=null)directory.Dispose();foreach(var d in extraDirectories)d.Handle.Dispose();extraDirectories.Clear();if(held){lease.ReleaseMutex();held=false;lease.Dispose();}disposed=true;
    }
}
