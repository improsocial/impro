#import <Capacitor/Capacitor.h>

// The first identifier is your Swift class name (RefreshControlPlugin)
// The second string ("RefreshControl") must match what you use in JS registerPlugin(...)
CAP_PLUGIN(RefreshControlPlugin, "RefreshControl",
  CAP_PLUGIN_METHOD(setRefresh, CAPPluginReturnPromise);
)