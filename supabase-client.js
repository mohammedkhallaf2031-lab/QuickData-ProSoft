// ============================================================
// SUPABASE CONFIGURATION - QuickData ProSoft
// ============================================================
const SUPABASE_URL = 'https://ejnhtqdbbjekkfrmwllo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ce8u1KEUYfMxYIayNF_CGQ_B7edEg2y';

// ============================================================
// SESSION FUNCTIONS
// ============================================================
function getSession() {
    var session = localStorage.getItem('rollex_session');
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch (e) {
        localStorage.removeItem('rollex_session');
        return null;
    }
}

function getToken() {
    var session = getSession();
    return session ? session.access_token : null;
}

// ============================================================
// GET CURRENT USER PROFILE
// ============================================================
async function getCurrentUserProfile() {
    var token = getToken();
    if (!token) return null;

    try {
        var userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token
            }
        });

        if (!userResponse.ok) return null;
        var user = await userResponse.json();

        var profileResponse = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=*&id=eq.' + user.id, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token
            }
        });

        if (!profileResponse.ok) return null;
        var data = await profileResponse.json();
        return data && data.length > 0 ? data[0] : null;

    } catch (error) {
        console.error('❌ خطأ في جلب البروفايل:', error);
        return null;
    }
}

// ============================================================
// GET COMPANY ID
// ============================================================
async function getCompanyId() {
    var token = getToken();
    if (!token) return null;

    try {
        var userResponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token
            }
        });

        if (!userResponse.ok) return null;
        var user = await userResponse.json();

        var profileResponse = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=company_id&id=eq.' + user.id, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token
            }
        });

        if (!profileResponse.ok) return null;
        var data = await profileResponse.json();
        return data && data.length > 0 ? data[0].company_id : null;

    } catch (error) {
        console.error('❌ خطأ في جلب company_id:', error);
        return null;
    }
}

// ============================================================
// GET COMPANY SUBSCRIPTION STATUS
// ============================================================
async function getCompanySubscriptionStatus() {
    var companyId = await getCompanyId();
    if (!companyId) {
        return { status: 'error', message: 'لا توجد شركة', isActive: false };
    }

    var token = getToken();
    if (!token) return { status: 'error', message: 'جلسة منتهية', isActive: false };

    try {
        var response = await fetch(SUPABASE_URL +
            '/rest/v1/companies?select=subscription_status,trial_end_date,subscription_end_date&id=eq.' + companyId, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + token
                }
            });

        if (!response.ok) {
            return { status: 'error', message: 'فشل جلب البيانات', isActive: false };
        }

        var data = await response.json();
        if (!data || data.length === 0) {
            return { status: 'error', message: 'الشركة غير موجودة', isActive: false };
        }

        var company = data[0];
        var today = new Date();
        today.setHours(0, 0, 0, 0);

        var status = company.subscription_status || 'trial';
        var daysRemaining = 0;

        if (status === 'trial' || status === 'active') {
            var endDate = status === 'trial' ?
                new Date(company.trial_end_date) :
                new Date(company.subscription_end_date);

            if (endDate && !isNaN(endDate.getTime())) {
                endDate.setHours(0, 0, 0, 0);
                var diffTime = endDate.getTime() - today.getTime();
                daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            }
        }

        var isActive = (status === 'trial' || status === 'active') && daysRemaining > 0;

        return {
            status: status,
            daysRemaining: daysRemaining,
            isActive: isActive,
            trialEndDate: company.trial_end_date,
            subscriptionEndDate: company.subscription_end_date,
            message: isActive ? 'الاشتراك نشط' : 'الاشتراك منتهي'
        };

    } catch (error) {
        console.error('❌ خطأ في جلب حالة الاشتراك:', error);
        return { status: 'error', message: error.message, isActive: false };
    }
}

// ============================================================
// REDIRECT TO LOGIN
// ============================================================
function redirectToLogin() {
    localStorage.removeItem('rollex_session');
    sessionStorage.removeItem('rollex_session');
    window.location.href = 'login.html';
}

// ============================================================
// SESSION MONITOR
// ============================================================
function startSessionMonitor() {
    setInterval(function() {
        var session = getSession();
        if (!session) return;

        var token = session.access_token;
        if (!token) return;

        fetch(SUPABASE_URL + '/auth/v1/user', {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token
            }
        })
        .then(function(response) {
            if (response.status === 401) {
                redirectToLogin();
            }
        })
        .catch(function() {});
    }, 30000);
}

// ============================================================
// GENERIC FUNCTIONS
// ============================================================
async function insertRow(tableName, payload) {
    var token = getToken();
    if (!token) throw new Error('يرجى تسجيل الدخول أولاً');

    var response = await fetch(SUPABASE_URL + '/rest/v1/' + tableName, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        var errorData = await response.text();
        throw new Error(errorData);
    }

    var result = await response.json();
    return Array.isArray(result) ? result[0] : result;
}

async function patchRow(tableName, id, payload) {
    var token = getToken();
    if (!token) return;

    var response = await fetch(SUPABASE_URL + '/rest/v1/' + tableName + '?id=eq.' + id, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        var errorData = await response.text();
        throw new Error(errorData);
    }

    return await response.json();
}

console.log('✅ تم تحميل supabase-client.js');
