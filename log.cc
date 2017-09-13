// ***** LOGGING IMPL. STARTS *****

static long IDS[(long)1e6] = { 0 };
static long CALL_LOG[(long)1e6] = { 0 };
static long LOG_COUNT = 0;
static int thread_counter = 1;
static thread_local int thread_id = 0;

inline ULONGLONG rdtsc()
{
    ULONGLONG H, L;
    __asm volatile ("rdtsc":"=a"(L), "=d"(H));
#ifdef _X86_
    return L;
#else
    return (H << 32) | L;
#endif
}

__attribute__((destructor))
static void PRINTLOG() {
  if (LOG_COUNT == -1) return;

  // for(long i = 0; i < LOG_COUNT; i+=5) {
  //   printf("%d, %d, %d, %d, %d\n", CALL_LOG[i], CALL_LOG[i + 1], CALL_LOG[i + 2], CALL_LOG[i + 3], CALL_LOG[i + 4]);
  // }
  LOG_COUNT = -1;

  for(long i = 0; i < 1e6; i++) {
    if (IDS[i] > 60000) {
      printf("%lu -> %lu\n", i, IDS[i]);
    }
  }
}

ULONGLONG start_tick = 0;
long LAST_ID = -1;

void TRACE_IT(long ID) {
  if (LOG_COUNT == -1) return;
  if (thread_id == 0 && thread_counter == 1) { thread_id = 1; thread_counter = 2; }
  else if (thread_id != 1) return;

  if (start_tick == 0) start_tick = rdtsc();

  CALL_LOG[LOG_COUNT++] = ID;
  if (LAST_ID != -1) {
    IDS[LAST_ID] += rdtsc() - start_tick;
  }
  LAST_ID = ID;

  start_tick = rdtsc();

  if (LOG_COUNT >= 9e5) {
    PRINTLOG();
  }
}

// ***** LOGGING IMPL. ENDS *****
