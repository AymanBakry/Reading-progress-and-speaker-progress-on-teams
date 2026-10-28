// بيانات الأنشطة - يمكنك إضافة نشاط جديد هنا كل أسبوعين بسهولة
const activitiesData = [
    {
        id: 1,
        title: "Bi-Weekly 1: Reading Progress Kickoff",
        category: "Reading Progress",
        description: "Introduction to Microsoft Reading Progress, assigning baseline fluency texts for students, and recording initial metrics.",
        dateRange: "Oct 01, 2026 - Oct 14, 2026",
        status: "Completed", // Active أو Completed
        link: "#" // استبدل الرابط برابط التوثيق أو الملفات على GitHub
    },
    {
        id: 2,
        title: "Bi-Weekly 2: Speaker Progress & Pronunciation",
        category: "Speaker Progress",
        description: "Focusing on common pronunciation errors, automated feedback analysis, and individual student voice recordings.",
        dateRange: "Oct 15, 2026 - Oct 28, 2026",
        status: "Active",
        link: "#"
    },
    {
        id: 3,
        title: "Bi-Weekly 3: Advanced Vocabulary & Expression",
        category: "Reading Progress",
        description: "Integrating vocabulary challenges within the reading passages to boost comprehension and expression scores.",
        dateRange: "Oct 29, 2026 - Nov 11, 2026",
        status: "Upcoming",
        link: "#"
    }
    // لإضافة نشاط جديد بعد أسبوعين، قم بنسخ أحد الأقسام أعلاه وتعديل البيانات والتاريخ والـ status
];

function renderActivities() {
    const container = document.getElementById('activities-container');
    container.innerHTML = '';

    activitiesData.forEach(activity => {
        let cardClass = 'activity-card';
        if (activity.status === 'Active') {
            cardClass += ' active';
        }

        const card = document.createElement('div');
        card.className = cardClass;

        card.innerHTML = `
            <span class="badge">${activity.category} - ${activity.status}</span>
            <h3>${activity.title}</h3>
            <p>${activity.description}</p>
            <div class="activity-meta">
                <span><i class="far fa-calendar-alt"></i> ${activity.dateRange}</span>
                <a href="${activity.link}" class="btn-link" target="_blank">View Evidence</a>
            </div>
        `;

        container.appendChild(card);
    });
}

// تنفيذ الداله عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', renderActivities);
