package com.melisaerp.nativeterminal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.content.pm.PackageManager;
import java.security.MessageDigest;
import androidx.core.content.ContextCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

/** Tests real DataWedge configuration and app association using the matching debug variant. */
@RunWith(AndroidJUnit4.class)
public class DataWedgeProfileAcceptanceTest {
    @Test public void profileConfigurationAcknowledgedByZebra() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        String profileName=context.getPackageName().endsWith(".worktest")?"MelisaNativeWorkTestV1":"MelisaNativeV1";
        String commandPrefix=context.getPackageName().endsWith(".worktest")?"MELISA_WORKTEST":"MELISA_NATIVE";
        CountDownLatch received=new CountDownLatch(1);
        CountDownLatch associated=new CountDownLatch(1);
        CountDownLatch intentConfigured=new CountDownLatch(1);
        Bundle[] intentParameters={null};
        String[] result={"", ""};
        BroadcastReceiver receiver=new BroadcastReceiver(){
            @Override public void onReceive(Context ctx, Intent intent){
                Bundle config=intent.getBundleExtra("com.symbol.datawedge.api.RESULT_GET_CONFIG");
                if(config!=null && profileName.equals(config.getString("PROFILE_NAME"))){
                    java.util.ArrayList<Bundle> plugins=config.getParcelableArrayList("PLUGIN_CONFIG");
                    if(plugins!=null)for(Bundle plugin:plugins)if("INTENT".equalsIgnoreCase(plugin.getString("PLUGIN_NAME"))){
                        intentParameters[0]=plugin.getBundle("PARAM_LIST");intentConfigured.countDown();
                    }
                    java.util.ArrayList<Bundle> apps=config.getParcelableArrayList("APP_LIST");
                    if(apps!=null)for(Bundle entry:apps)if(context.getPackageName().equals(entry.getString("PACKAGE_NAME")))associated.countDown();
                }
                if((commandPrefix+"_ASSOCIATE").equals(intent.getStringExtra("COMMAND_IDENTIFIER")) && "SUCCESS".equals(intent.getStringExtra("RESULT")))associated.countDown();
                if(!(commandPrefix+"_PROFILE").equals(intent.getStringExtra("COMMAND_IDENTIFIER")))return;
                result[0]=intent.getStringExtra("RESULT");
                Bundle info=intent.getBundleExtra("RESULT_INFO");
                if(info!=null)for(String key:info.keySet())result[1]+=key+"="+String.valueOf(info.get(key))+"; ";
                received.countDown();
            }
        };
        IntentFilter filter=new IntentFilter("com.symbol.datawedge.api.RESULT_ACTION");filter.addCategory(Intent.CATEGORY_DEFAULT);
        ContextCompat.registerReceiver(context,receiver,filter,ContextCompat.RECEIVER_EXPORTED);
        try {
            context.startActivity(new Intent().setClassName(context,"com.melisaerp.nativeterminal.MainActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));
            assertTrue("DataWedge did not acknowledge native profile",received.await(15,TimeUnit.SECONDS));
            assertEquals("DataWedge: "+result[1],"SUCCESS",result[0]);
            assertTrue("Native app association was not verified",associated.await(10,TimeUnit.SECONDS));
            Bundle query=new Bundle();query.putString("PROFILE_NAME",profileName);
            Bundle plugin=new Bundle();plugin.putStringArrayList("PLUGIN_NAME",new java.util.ArrayList<>(java.util.Arrays.asList("INTENT")));
            query.putBundle("PLUGIN_CONFIG",plugin);
            context.sendBroadcast(new Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge").putExtra("com.symbol.datawedge.api.GET_CONFIG",query));
            assertTrue("Intent output config was not returned",intentConfigured.await(10,TimeUnit.SECONDS));
            Bundle params=intentParameters[0];assertNotNull(params);
            assertEquals(context.getPackageName()+".SCAN",params.getString("intent_action"));
            assertEquals("2",String.valueOf(params.get("intent_delivery")));
            String legacy=sha1(context.getPackageManager().getPackageInfo(context.getPackageName(),PackageManager.GET_SIGNATURES).signatures[0].toByteArray());
            String current=sha1(context.getPackageManager().getPackageInfo(context.getPackageName(),PackageManager.GET_SIGNING_CERTIFICATES).signingInfo.getApkContentsSigners()[0].toByteArray());
            System.out.println("NATIVE_SCANNER_CERT legacy="+legacy+" current="+current);
            java.util.ArrayList<Bundle> components=params.getParcelableArrayList("intent_component_info");
            assertNotNull("Explicit scanner destination missing",components);
            assertEquals("Only native application may receive scans",1,components.size());
            assertEquals(context.getPackageName(),components.get(0).getString("PACKAGE_NAME"));
            assertEquals("DataWedge signature must use Zebra's GET_SIGNATURES contract, including rotated releases",legacy,components.get(0).getString("SIGNATURE"));
        } finally {context.unregisterReceiver(receiver);}
    }
    private static String sha1(byte[] bytes) throws Exception {
        StringBuilder result=new StringBuilder();for(byte b:MessageDigest.getInstance("SHA-1").digest(bytes))result.append(String.format("%02X",b));return result.toString();
    }
}
