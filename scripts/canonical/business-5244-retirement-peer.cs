using System;using System.IO.Pipes;using System.Runtime.InteropServices;using System.Security.AccessControl;using System.Security.Principal;using System.Security.Cryptography;using System.Text;using Microsoft.Win32.SafeHandles;
// Captures only the process attached to a retained local pipe handle. No PID,
// command or arbitrary pipe name is accepted as a peer identity input.
public sealed class Business5244RetirementPeer:IDisposable {
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeClientProcessId(SafePipeHandle pipe,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeServerProcessId(SafePipeHandle pipe,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll")]static extern bool GetProcessTimes(IntPtr handle,out long birth,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(IntPtr handle,uint exitCode);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")]static extern uint GetCurrentProcessId();
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
 IntPtr process;readonly long birth;readonly string sid;readonly bool serverPeer;bool closed;
 public uint Pid{get;private set;}public string Birth{get{return birth.ToString(System.Globalization.CultureInfo.InvariantCulture);}}public string Sid{get{return sid;}}
 public static string CurrentSid{get{using(var id=WindowsIdentity.GetCurrent()){return id.User.Value;}}}
 public static uint CurrentPid{get{return GetCurrentProcessId();}}
 public static string CurrentBirth{get{long a,b,c,d;if(!GetProcessTimes(GetCurrentProcess(),out a,out b,out c,out d))throw new Exception("RETIREMENT_OWNER_BIRTH_UNAVAILABLE");return a.ToString(System.Globalization.CultureInfo.InvariantCulture);}}
 static string ProcessSid(IntPtr handle){IntPtr token;if(!OpenProcessToken(handle,8,out token))throw new Exception("RETIREMENT_PEER_TOKEN_UNAVAILABLE");try{using(var id=new WindowsIdentity(token)){return id.User.Value;}}finally{CloseHandle(token);}}
 Business5244RetirementPeer(uint pid,bool isServer){serverPeer=isServer;Pid=pid;process=OpenProcess(0x00101000,false,pid);try{long b,c,d;if(process==IntPtr.Zero||!GetProcessTimes(process,out birth,out b,out c,out d)||WaitForSingleObject(process,0)!=258)throw new Exception("RETIREMENT_PEER_NOT_LIVE");sid=ProcessSid(process);if(sid!=CurrentSid)throw new Exception("RETIREMENT_PEER_SID_MISMATCH");}catch{Dispose();throw;}}
 public static Business5244RetirementPeer CaptureClient(NamedPipeServerStream pipe){uint pid;if(!GetNamedPipeClientProcessId(pipe.SafePipeHandle,out pid)||pid==0)throw new Exception("RETIREMENT_PIPE_CLIENT_ID_UNAVAILABLE");return new Business5244RetirementPeer(pid,false);}
 public static Business5244RetirementPeer CaptureServer(NamedPipeClientStream pipe){uint pid;if(!GetNamedPipeServerProcessId(pipe.SafePipeHandle,out pid)||pid==0)throw new Exception("RETIREMENT_PIPE_SERVER_ID_UNAVAILABLE");return new Business5244RetirementPeer(pid,true);}
 public void Validate(){long a,b,c,d;if(closed||process==IntPtr.Zero||!GetProcessTimes(process,out a,out b,out c,out d)||a!=birth||WaitForSingleObject(process,0)!=258||sid!=CurrentSid||ProcessSid(process)!=sid)throw new Exception("RETIREMENT_NATIVE_PEER_CHANGED");}
 public void Dispose(){if(closed)return;closed=true;if(process!=IntPtr.Zero){CloseHandle(process);process=IntPtr.Zero;}}
 // One explicitly authorized maintenance action can bind terminate rights to
 // the already authenticated native pipe peer. No PID/name command input and
 // no change to the normal status/retire protocol or its permissions.
 public ControlledShutdown OpenControlledShutdown(){Validate();if(!serverPeer)throw new Exception("RETIREMENT_CONTROL_SERVER_PEER_REQUIRED");return new ControlledShutdown(this);}
 public sealed class ControlledShutdown:IDisposable {
  IntPtr handle;readonly long birth;readonly string sid;readonly uint issuer;readonly int thread;bool attempted;
  public uint TargetPid{get;private set;}public string TargetBirth{get{return birth.ToString(System.Globalization.CultureInfo.InvariantCulture);}}
  internal ControlledShutdown(Business5244RetirementPeer peer){
   peer.Validate();issuer=GetCurrentProcessId();thread=System.Threading.Thread.CurrentThread.ManagedThreadId;TargetPid=peer.Pid;birth=peer.birth;sid=peer.sid;
   handle=OpenProcess(0x00101001,false,TargetPid);
   try{Validate();peer.Validate();}catch{Dispose();throw;}
  }
  public void Validate(){long a,b,c,d;if(issuer!=GetCurrentProcessId()||thread!=System.Threading.Thread.CurrentThread.ManagedThreadId||handle==IntPtr.Zero||!GetProcessTimes(handle,out a,out b,out c,out d)||a!=birth||WaitForSingleObject(handle,0)!=258||sid!=CurrentSid||ProcessSid(handle)!=sid)throw new Exception("RETIREMENT_CONTROL_NATIVE_TARGET_CHANGED");}
  public void Stop(){Validate();if(attempted)throw new Exception("RETIREMENT_CONTROL_STOP_REPLAY");attempted=true;if(!TerminateProcess(handle,1)||WaitForSingleObject(handle,10000)!=0)throw new Exception("RETIREMENT_CONTROL_STOP_UNCONFIRMED");}
  public void Dispose(){if(handle!=IntPtr.Zero){CloseHandle(handle);handle=IntPtr.Zero;}}
 }
}
public static class Business5244RetirementPipe {
 [StructLayout(LayoutKind.Sequential)]struct SA{public int length;public IntPtr descriptor;[MarshalAs(UnmanagedType.Bool)]public bool inherit;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafePipeHandle CreateNamedPipe(string name,uint mode,uint pipeMode,uint instances,uint output,uint input,uint timeout,ref SA security);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool PeekNamedPipe(SafePipeHandle pipe,IntPtr buffer,uint size,IntPtr read,out uint available,IntPtr left);
 static string Hash(string value){using(var h=SHA256.Create()){return BitConverter.ToString(h.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-","").ToLowerInvariant();}}
 public static string Name{get{string mutex="Global\\MelisaERP5244Startup-"+Business5244RetirementPeer.CurrentSid+"-"+Hash("C:\\Sirket\\ERP\\runtime\\UNIFIED-5244-SEMIH-20261027".ToLowerInvariant());return "MelisaERP5244Retirement-"+Hash(mutex);}}
 public static NamedPipeServerStream CreateServer(){
  var sid=new SecurityIdentifier(Business5244RetirementPeer.CurrentSid);var acl=new PipeSecurity();acl.SetAccessRuleProtection(true,false);acl.SetOwner(sid);acl.AddAccessRule(new PipeAccessRule(sid,PipeAccessRights.FullControl,AccessControlType.Allow));
  byte[] descriptor=acl.GetSecurityDescriptorBinaryForm();var pinned=GCHandle.Alloc(descriptor,GCHandleType.Pinned);
  try{SA sa=new SA();sa.length=Marshal.SizeOf(typeof(SA));sa.descriptor=pinned.AddrOfPinnedObject();sa.inherit=false;
   // FIRST_PIPE_INSTANCE + OVERLAPPED, byte mode, reject remote clients.
   SafePipeHandle h=CreateNamedPipe("\\\\.\\pipe\\"+Name,0x40080003,8,1,512,512,0,ref sa);
   if(h.IsInvalid){h.Dispose();throw new Exception("RETIREMENT_PIPE_FIRST_INSTANCE_UNAVAILABLE");}
   try{return new NamedPipeServerStream(PipeDirection.InOut,true,false,h);}catch{h.Dispose();throw;}
  }finally{pinned.Free();}
 }
 public static NamedPipeClientStream Connect(){var pipe=new NamedPipeClientStream(".",Name,PipeDirection.InOut,PipeOptions.Asynchronous,TokenImpersonationLevel.Identification);try{pipe.Connect(5000);return pipe;}catch{pipe.Dispose();throw new Exception("RETIREMENT_CONNECT_UNCONFIRMED");}}
 public static void AssertNoExtraBytes(PipeStream pipe){uint n;if(!pipe.IsConnected||!PeekNamedPipe(pipe.SafePipeHandle,IntPtr.Zero,0,IntPtr.Zero,out n,IntPtr.Zero))throw new Exception("RETIREMENT_PIPE_CLOSED");if(n!=0)throw new Exception("RETIREMENT_SECOND_BODY_REJECTED");}
}
