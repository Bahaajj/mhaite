
"use strict";

// نفس إعدادات Supabase الموجودة في ملف إدارة الموقع
const SCHEDULE_SUPABASE_URL =
  "https://pbqnrxpvosnlqujeeshd.supabase.co";

const SCHEDULE_SUPABASE_KEY =
  "sb_publishable_67AmM4fHGg3yXrJG4MusiA_ctG996Ff";

const supabaseClient = window.supabase
  ? window.supabase.createClient(
      SCHEDULE_SUPABASE_URL,
      SCHEDULE_SUPABASE_KEY
    )
  : null;

async function loadPublicSchedules() {
  const currentWater = document.getElementById("currentWater");
  const waterNote = document.getElementById("waterNote");
  const waterGrid = document.getElementById("waterGrid");
  const wasteRows = document.getElementById("wasteRows");
  const updatedText = document.getElementById("scheduleUpdated");
  const errorBox = document.getElementById("scheduleError");

  if (!supabaseClient) {
    showScheduleError("تعذّر تشغيل الاتصال. تحقق من تحميل مكتبة Supabase.");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("municipality_schedules")
      .select("schedule_data, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (!data || !data.schedule_data) {
      throw new Error("لم يُعثر على جدول المواعيد في قاعدة البيانات.");
    }

    const schedule = data.schedule_data;

    if (
      !Array.isArray(schedule.neighborhoods) ||
      schedule.neighborhoods.length === 0
    ) {
      throw new Error("لا توجد حارات مسجلة في الجدول.");
    }

    const neighborhoods = [...schedule.neighborhoods].sort(
      (a, b) => Number(a.water_order) - Number(b.water_order)
    );

    currentWater.textContent =
      schedule.current_water_neighborhood || "لم يُحدّد دور المياه الحالي";

    waterNote.textContent = schedule.water_note || "";

    waterGrid.replaceChildren();
    wasteRows.replaceChildren();
    errorBox.hidden = true;

    neighborhoods.forEach((neighborhood, index) => {
      const isCurrent =
        neighborhood.name === schedule.current_water_neighborhood;

      // بطاقة دور المياه
      const card = document.createElement("article");
      card.className = "card" + (isCurrent ? " active" : "");

      const title = document.createElement("h3");
      title.textContent = neighborhood.name || `الحارة ${index + 1}`;

      const detail = document.createElement("p");
      detail.textContent = isCurrent
        ? "عليها الدور حاليًا"
        : `ترتيب الدور: ${neighborhood.water_order ?? index + 1}`;

      card.append(title, detail);
      waterGrid.appendChild(card);

      // صف برنامج النفايات
      const row = document.createElement("tr");

      [
        neighborhood.name || `الحارة ${index + 1}`,
        neighborhood.waste_day || "لم يُحدّد",
        schedule.waste_time || "صباحًا"
      ].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      wasteRows.appendChild(row);
    });

    if (data.updated_at) {
      const date = new Date(data.updated_at);

      updatedText.textContent = Number.isNaN(date.getTime())
        ? ""
        : `آخر تحديث للجدول: ${date.toLocaleString("ar-LB")}`;
    } else {
      updatedText.textContent = "";
    }
  } catch (error) {
    console.error("Public schedules loading error:", error);

    currentWater.textContent = "تعذّر تحميل جدول المواعيد";
    waterNote.textContent = "";
    waterGrid.replaceChildren();

    wasteRows.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = "تعذّر تحميل مواعيد جمع النفايات.";
    row.appendChild(cell);
    wasteRows.appendChild(row);

    showScheduleError(
      "ما قدرنا نحمّل الجدول. تحقق من وجود سجل في municipality_schedules ومن صلاحيات القراءة العامة في Supabase. التفاصيل: " +
      (error.message || error)
    );
  }

  function showScheduleError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
}

// مهم: تشغيل الدالة عند فتح الصفحة
document.addEventListener("DOMContentLoaded", loadPublicSchedules);
