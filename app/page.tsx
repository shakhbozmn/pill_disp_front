"use client";

import { database } from "@/app/services/firebaseClient";
import {
  get,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { useEffect, useState } from "react";
import {
  FaCalendarAlt,
  FaCapsules,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaFileAlt,
  FaPills,
  FaPlay,
  FaRedo,
  FaRocket,
  FaSave,
  FaTimesCircle,
  FaTrash,
} from "react-icons/fa";

const DEVICE_ID = "my_device_1";

interface Schedule {
  slot: number;
  status?: string;
  time?: string;
  medicationName?: string;
}

export default function Home() {
  const [schedules, setSchedules] = useState<{ [key: string]: Schedule }>({});
  const [hour, setHour] = useState<string>("08");
  const [minute, setMinute] = useState<string>("00");
  const [slot, setSlot] = useState<string>("1");
  const [medicationName, setMedicationName] = useState<string>("Medicine A");
  const [logs, setLogs] = useState<
    { timestamp: string; status: string; slot: number; details?: string }[]
  >([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [triggeringSlot, setTriggeringSlot] = useState<number | null>(null);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const connectedRef = ref(database, ".info/connected");
    onValue(connectedRef, (snapshot) => {
      const val = snapshot.val();
      setIsDbConnected(val === true);
    });

    const slotsRef = ref(database, `${DEVICE_ID}/slots`);
    onValue(slotsRef, (snapshot) => {
      const val = snapshot.val() || {};
      console.log("Slots data:", val);

      const schedulesData: { [key: string]: Schedule } = {};

      for (let slotNum = 1; slotNum <= 6; slotNum++) {
        const slotKey = `slot${slotNum}`;
        if (val[slotKey] && val[slotKey].enabled) {
          const slotData = val[slotKey];
          const timeKey = `${String(slotData.hour).padStart(2, "0")}:${String(
            slotData.minute
          ).padStart(2, "0")}`;

          schedulesData[timeKey] = {
            slot: slotNum,
            status: slotData.status || "pending",
            medicationName: slotData.medicationName || `Medicine ${slotNum}`,
            time: timeKey,
          };
        }
      }

      setSchedules(schedulesData);
      setIsLoadingSchedules(false);
    });

    const logsRef = ref(database, `${DEVICE_ID}/logs`);
    onValue(logsRef, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.values(val) as {
          timestamp: string;
          status: string;
          slot: number;
          details?: string;
        }[];
        setLogs(arr.reverse());
      } else {
        setLogs([]);
      }
      setIsLoadingLogs(false);
    });
  }, []);

  async function addSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const slotNum = parseInt(slot);
    if (slotNum < 1 || slotNum > 6) {
      return;
    }

    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);

    if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
      return;
    }

    if (isNaN(minuteNum) || minuteNum < 0 || minuteNum > 59) {
      return;
    }

    const slotRef = ref(database, `${DEVICE_ID}/slots/slot${slotNum}`);

    await set(slotRef, {
      enabled: true,
      hour: hourNum,
      minute: minuteNum,
      medicationName: medicationName || `Medicine ${slotNum}`,
      status: "pending",
      lastUpdated: new Date()
        .toLocaleTimeString("en-US", { hour12: false })
        .substring(0, 5),
    });

    setHour("08");
    setMinute("00");
    setSlot("1");
    setMedicationName("Medicine A");
  }

  async function deleteSchedule(slotNum: number) {
    const slotRef = ref(database, `${DEVICE_ID}/slots/slot${slotNum}`);

    await set(slotRef, {
      enabled: false,
      hour: 0,
      minute: 0,
      medicationName: "",
      status: "pending",
      lastUpdated: new Date()
        .toLocaleTimeString("en-US", { hour12: false })
        .substring(0, 5),
    });
  }

  async function triggerDispense(slotNum: number) {
    if (triggeringSlot !== null) {
      return;
    }

    setTriggeringSlot(slotNum);

    const slotRef = ref(database, `${DEVICE_ID}/slots/slot${slotNum}`);

    try {
      const currentData = await get(slotRef);
      const slotData = currentData.val();

      if (slotData && slotData.enabled) {
        await set(slotRef, {
          ...slotData,
          manualTrigger: true,
          status: "manual_trigger",
          lastUpdated: new Date()
            .toLocaleTimeString("en-US", { hour12: false })
            .substring(0, 5),
        });

        const logRef = ref(database, `${DEVICE_ID}/logs`);
        const newLogRef = push(logRef);
        await set(newLogRef, {
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
          status: "manual_trigger",
          slot: slotNum,
          details: "Manually triggered from dashboard",
          date: new Date().toISOString().split("T")[0],
        });
      }
    } finally {
      setTriggeringSlot(null);
    }
  }

  async function resetScheduleStatus(slotNum: number) {
    const slotRef = ref(database, `${DEVICE_ID}/slots/slot${slotNum}`);

    const currentData = await get(slotRef);
    const slotData = currentData.val();

    if (slotData) {
      await update(slotRef, {
        status: "pending",
        manualTrigger: false,
        lastUpdated: new Date()
          .toLocaleTimeString("en-US", { hour12: false })
          .substring(0, 5),
      });
    }
  }

  async function clearLogs() {
    const logRef = ref(database, `${DEVICE_ID}/logs`);
    await remove(logRef);
  }

  const activeSlots = Object.values(schedules).filter(
    (s) => s.status !== undefined
  );

  const scheduleEntries = Object.entries(schedules)
    .filter(([, schedule]) => schedule.status)
    .sort(([timeA], [timeB]) => timeA.localeCompare(timeB));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "taken":
        return <FaCheckCircle className="text-lg" />;
      case "missed":
        return <FaTimesCircle className="text-lg" />;
      case "started":
      case "manual_trigger":
        return <FaRocket className="text-lg" />;
      case "in_progress":
        return <FaRocket className="text-lg animate-pulse" />;
      default:
        return <FaFileAlt className="text-lg" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "taken":
        return "Medication Taken";
      case "missed":
        return "Medication Missed";
      case "started":
        return "Dispensing Started";
      case "manual_trigger":
        return "Manually Triggered";
      case "in_progress":
        return "Dispensing in Progress";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-6 md:px-8 md:py-10 text-slate-900 dark:text-slate-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900 shadow-sm">
                <FaPills className="text-lg" />
              </span>
              <span className="flex flex-col gap-1">
                <span>Pill Dispenser</span>
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  Real-time dashboard for your smart dispenser
                </span>
              </span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  isDbConnected === null
                    ? "bg-amber-500 animate-pulse"
                    : isDbConnected
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              />
              {isDbConnected === null
                ? "Connecting to database..."
                : isDbConnected
                ? "Connected"
                : "Disconnected"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 font-mono text-xs text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              ID: {DEVICE_ID}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/80 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm backdrop-blur-sm">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50 mb-5 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <FaCalendarAlt className="text-sm" />
              </span>
              Slot Configuration
            </h2>
            <form onSubmit={addSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Slot Number
                </label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-slate-50 dark:focus:ring-slate-50/15"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      Slot {num}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Medication Name
                </label>
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-slate-50 dark:focus:ring-slate-50/15"
                  placeholder="Enter medication name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                  Dispensing Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    value={hour}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      if (raw.length <= 2) {
                        setHour(raw);
                      }
                    }}
                    onBlur={() => {
                      if (hour.length === 1) {
                        setHour(hour.padStart(2, "0"));
                      }
                    }}
                    className="w-20 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-center text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-slate-50 dark:focus:ring-slate-50/15"
                    placeholder="HH"
                  />
                  <span className="text-lg font-medium text-slate-400">:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    value={minute}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      if (raw.length <= 2) {
                        setMinute(raw);
                      }
                    }}
                    onBlur={() => {
                      if (minute.length === 1) {
                        setMinute(minute.padStart(2, "0"));
                      }
                    }}
                    className="w-20 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white text-center text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:focus:border-slate-50 dark:focus:ring-slate-50/15"
                    placeholder="MM"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-50 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-slate-800 hover:shadow-md active:translate-y-0 active:shadow-sm dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <FaSave className="text-xs" />
                <span>Save configuration</span>
              </button>
            </form>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <FaCalendarAlt className="text-sm" />
                </span>
                <span>Active schedules</span>
              </h2>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full text-xs font-medium">
                Active: {scheduleEntries.length}
              </span>
            </div>

            {isLoadingSchedules ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-dashed border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3 w-32 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                        <div className="flex gap-2">
                          <div className="h-3 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                          <div className="h-3 w-16 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                      <div className="h-8 w-8 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : scheduleEntries.length === 0 ? (
              <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                <FaCalendarAlt className="text-4xl mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-sm">No active schedules yet</p>
                <p className="text-xs mt-1">
                  Configure a slot on the left to create your first schedule.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {scheduleEntries.map(([time, schedule]) => (
                  <div
                    key={`${schedule.slot}-${time}`}
                    className={`p-4 rounded-xl border text-sm transition-colors ${
                      schedule.status === "in_progress"
                        ? "border-amber-300/70 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-950/20"
                        : schedule.status === "taken"
                        ? "border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-950/20"
                        : schedule.status === "missed"
                        ? "border-rose-300/70 bg-rose-50/70 dark:border-rose-500/50 dark:bg-rose-950/20"
                        : "border-slate-200 bg-slate-50/80 hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-xs font-medium ${
                            schedule.status === "in_progress"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                              : schedule.status === "taken"
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100"
                              : schedule.status === "missed"
                              ? "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100"
                              : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                          }`}
                        >
                          <span className="text-base font-semibold">
                            #{schedule.slot}
                          </span>
                          <span className="mt-0.5 opacity-80">{time}</span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-50">
                            {schedule.medicationName || `Slot ${schedule.slot}`}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                schedule.status === "in_progress"
                                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                                  : schedule.status === "taken"
                                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100"
                                  : schedule.status === "missed"
                                  ? "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100"
                                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {schedule.status || "pending"}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            <span className="inline-flex items-center gap-1">
                              <FaClock className="text-[10px]" />
                              {time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1.5">
                        {schedule.status === "pending" && (
                          <button
                            onClick={() => triggerDispense(schedule.slot)}
                            disabled={triggeringSlot === schedule.slot}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-900 hover:text-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900 ${
                              triggeringSlot === schedule.slot
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                            title="Trigger dispensing"
                          >
                            {triggeringSlot === schedule.slot ? (
                              <FaRocket className="text-xs animate-pulse" />
                            ) : (
                              <FaPlay className="text-xs" />
                            )}
                          </button>
                        )}
                        {(schedule.status === "taken" ||
                          schedule.status === "missed") && (
                          <button
                            onClick={() => resetScheduleStatus(schedule.slot)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-amber-600 transition-colors hover:bg-amber-100 dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
                            title="Reset to pending"
                          >
                            <FaRedo className="text-xs" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteSchedule(schedule.slot)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-600 transition-colors hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          title="Disable slot"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <FaClipboardList />
              Activity Logs
            </h2>
            <div className="flex gap-2">
              <button
                onClick={clearLogs}
                className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/60"
              >
                <FaTrash className="text-[11px]" />
                <span>Clear all</span>
              </button>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/80 dark:bg-slate-900/40"
                >
                  <div className="h-9 w-9 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-3 w-20 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                      <div className="h-3 w-14 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                      <div className="h-3 w-24 rounded-full bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              <FaClipboardList className="text-4xl mx-auto mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-sm">No activity logs yet</p>
              <p className="text-xs mt-1">
                System events will appear here as the dispenser is used.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm transition-colors hover:bg-white dark:border-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs ${
                      log.status === "taken"
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200"
                        : log.status === "missed"
                        ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-200"
                        : log.status === "started" ||
                          log.status === "in_progress" ||
                          log.status === "manual_trigger"
                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {getStatusIcon(log.status)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-50">
                      {getStatusText(log.status)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <FaClock className="text-[10px]" />
                        {log.timestamp}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="inline-flex items-center gap-1">
                        <FaCapsules className="text-[10px]" />
                        Slot {log.slot}
                      </span>
                      {log.details && (
                        <>
                          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span className="inline-flex items-center gap-1">
                            <FaFileAlt className="text-[10px]" />
                            {log.details}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white/80 dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50 mb-5">
            System Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                Total Slots
              </div>
              <div className="text-2xl font-semibold">6</div>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100 border border-emerald-200/70 dark:border-emerald-800/70">
              <div className="text-xs font-medium uppercase tracking-wide text-emerald-700/90 dark:text-emerald-200 mb-1.5">
                Active Schedules
              </div>
              <div className="text-2xl font-semibold">{activeSlots.length}</div>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100 border border-amber-200/70 dark:border-amber-800/70">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-700/90 dark:text-amber-200 mb-1.5">
                Pending
              </div>
              <div className="text-2xl font-semibold">
                {activeSlots.filter((s) => s.status === "pending").length}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-50 dark:bg-slate-50 dark:text-slate-900 border border-slate-900/10 dark:border-slate-200/80">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-300 dark:text-slate-600 mb-1.5">
                Total Logs
              </div>
              <div className="text-2xl font-semibold">{logs.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
