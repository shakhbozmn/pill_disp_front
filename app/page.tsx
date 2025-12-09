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

  useEffect(() => {
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
    });
  }, []);

  async function addSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const slotNum = parseInt(slot);
    if (slotNum < 1 || slotNum > 6) {
      return;
    }

    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);

    if (hourNum < 0 || hourNum > 23) {
      return;
    }

    if (minuteNum < 0 || minuteNum > 59) {
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
    const slotRef = ref(database, `${DEVICE_ID}/slots/slot${slotNum}`);

    const currentData = await get(slotRef);
    const slotData = currentData.val();

    if (slotData && slotData.enabled) {
      await set(slotRef, {
        ...slotData,
        manualTrigger: true,
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
            <FaPills className="text-blue-600 dark:text-blue-400" />
            Pill Dispenser Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Device ID:{" "}
            <span className="font-mono font-semibold">{DEVICE_ID}</span>
            <span className="ml-4">Available Slots: 1-6</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              Slot Configuration
            </h2>
            <form onSubmit={addSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Slot Number
                </label>
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      Slot {num}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Medication Name
                </label>
                <input
                  type="text"
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter medication name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dispensing Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={hour}
                    onChange={(e) => setHour(e.target.value.padStart(2, "0"))}
                    className="w-20 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="HH"
                  />
                  <span className="text-xl font-bold text-gray-500">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minute}
                    onChange={(e) => setMinute(e.target.value.padStart(2, "0"))}
                    className="w-20 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="MM"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <FaSave />
                Save Configuration
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Active Schedules
              </h2>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                {scheduleEntries.length} active
              </span>
            </div>

            {scheduleEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <FaCalendarAlt className="text-5xl mx-auto mb-4 text-gray-400" />
                <p className="font-medium">No active schedules</p>
                <p className="text-sm mt-1">Configure a slot to get started</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {scheduleEntries.map(([time, schedule]) => (
                  <div
                    key={`${schedule.slot}-${time}`}
                    className={`p-4 rounded-lg transition-colors ${
                      schedule.status === "in_progress"
                        ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                        : schedule.status === "taken"
                        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                        : schedule.status === "missed"
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                        : "bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center ${
                            schedule.status === "in_progress"
                              ? "bg-yellow-100 dark:bg-yellow-900/30"
                              : schedule.status === "taken"
                              ? "bg-green-100 dark:bg-green-900/30"
                              : schedule.status === "missed"
                              ? "bg-red-100 dark:bg-red-900/30"
                              : "bg-blue-100 dark:bg-blue-900/30"
                          }`}
                        >
                          <span className="text-lg font-bold">
                            #{schedule.slot}
                          </span>
                          <span className="text-xs">{time}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {schedule.medicationName || `Slot ${schedule.slot}`}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                schedule.status === "in_progress"
                                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                                  : schedule.status === "taken"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                  : schedule.status === "missed"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                              }`}
                            >
                              {schedule.status || "pending"}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <FaClock className="text-xs" />
                              {time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {schedule.status === "pending" && (
                          <button
                            onClick={() => triggerDispense(schedule.slot)}
                            className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Trigger dispensing"
                          >
                            <FaPlay />
                          </button>
                        )}
                        {(schedule.status === "taken" ||
                          schedule.status === "missed") && (
                          <button
                            onClick={() => resetScheduleStatus(schedule.slot)}
                            className="p-2 text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                            title="Reset to pending"
                          >
                            <FaRedo />
                          </button>
                        )}
                        <button
                          onClick={() => deleteSchedule(schedule.slot)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Disable slot"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FaClipboardList />
              Activity Logs
            </h2>
            <div className="flex gap-2">
              <button
                onClick={clearLogs}
                className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-2"
              >
                <FaTrash className="text-xs" />
                Clear All
              </button>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FaClipboardList className="text-5xl mx-auto mb-4 text-gray-400" />
              <p className="font-medium">No activity logs</p>
              <p className="text-sm mt-1">System activity will appear here</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      log.status === "taken"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : log.status === "missed"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        : log.status === "started" ||
                          log.status === "in_progress" ||
                          log.status === "manual_trigger"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {getStatusIcon(log.status)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {getStatusText(log.status)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-2 items-center">
                      <span className="flex items-center gap-1">
                        <FaClock className="text-xs" />
                        {log.timestamp}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <FaCapsules className="text-xs" />
                        Slot {log.slot}
                      </span>
                      {log.details && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <FaFileAlt className="text-xs" />
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

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            System Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-blue-600 dark:text-blue-400 text-sm font-medium mb-1">
                Total Slots
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                6
              </div>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-green-600 dark:text-green-400 text-sm font-medium mb-1">
                Active Schedules
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {activeSlots.length}
              </div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-yellow-600 dark:text-yellow-400 text-sm font-medium mb-1">
                Pending
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {activeSlots.filter((s) => s.status === "pending").length}
              </div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-purple-600 dark:text-purple-400 text-sm font-medium mb-1">
                Total Logs
              </div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {logs.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
