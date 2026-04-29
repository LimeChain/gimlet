// Shared state container for the debugger session
const DEFAULT_TCP_PORT = 1212;
const DEFAULT_STOP_ON_ENTRY = true;
const DEFAULT_PLATFORM_TOOLS_VERSION = '1.54';
const MIN_PLATFORM_TOOLS_VERSION = '1.54';
const LIB_EXT = process.platform === 'darwin' ? 'dylib' : 'so';

module.exports = {                                                                                                                                                                          
    DEFAULT_TCP_PORT,                                                                                                                                                                         
    DEFAULT_STOP_ON_ENTRY,                              
    DEFAULT_PLATFORM_TOOLS_VERSION,                                                                                                                                                           
    MIN_PLATFORM_TOOLS_VERSION,                                                                                                                                                               
    LIB_EXT,                                                                                                                                                                                  
};    