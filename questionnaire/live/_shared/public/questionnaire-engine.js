// questionnaire-engine.js
class QuestionnaireEngine {
    constructor(config) {
        this.config = config;
        this.db = window.db;

        console.log('QuestionnaireEngine: Initializing with config:', this.config.id);

        if (!this.db) {
            console.error('QuestionnaireEngine: Firebase DB (window.db) is not initialized.');
            // We continue as it might be initialized later or some features don't need it immediately
        }

        const isMensWellnessQuiz = this.config.id === 'mens-wellness';
        const stepTwoLabel = document.getElementById('health-metrics-form') ? 'About You & Metrics' : 'About You';

        let initialProgressConfig = [{
            id: 'about-you',
            label: this.config.progressSteps?.find(p => p.key === 'about-you')?.label || 'About You',
            step: 2,
            displayStep: 1,
            key: 'userInfo',
            type: 'form'
        },];

        if (this.config.progressSteps && this.config.progressSteps.length > 0) {
            const staticSteps = this.config.progressSteps.filter(p => p.step > 2);
            staticSteps.forEach((s) => {
                initialProgressConfig.push({
                    id: s.key,
                    label: s.label,
                    step: s.step,
                    displayStep: s.step - 2,
                    key: s.key,
                    type: 'single-select'
                });
            });
        }

        const offset = initialProgressConfig.length - 1;
        this.progressConfig = [
            ...initialProgressConfig,
            ...this.config.questionGroups.map((g, index) => {
                const displayStep = g.step - offset;
                const label = g.label || (g.key.charAt(0).toUpperCase() + g.key.slice(1).replace(/_/g, ' '));
                return {
                    id: g.key,
                    label: label,
                    step: g.step,
                    displayStep: displayStep,
                    key: g.key,
                    totalQuestions: g.questions.length || 0,
                };
            })
        ];

        this.state = {
            currentStep: 1,
            userInfo: {},
            healthMetrics: {
                height: null,
                currentWeight: null,
                targetWeight: null,
                bmi: null
            },
            partialDocId: null,
            finalDocId: null,
            healthScore: 0,
            recommendedProducts: [],
            results: {},
            allAnswers: {
                concern: [],
            },
        };

        this.config.questionGroups.forEach((group) => {
            this.state.allAnswers[group.key] = this.state.allAnswers[group.key] || [];
        });

        this.otpTimer = null;
        this.enteredPhone = '';
        this.otpExpiresAt = 0;

        // Localization Support
        try {
            this.currentLanguage = localStorage.getItem(`selected_lang_${this.config.id}`) || 'en';
        } catch (e) {
            console.warn('QuestionnaireEngine: localStorage access blocked, defaulting to English.');
            this.currentLanguage = 'en';
        }
        this.uiTranslations = {
            'en': {
                'btn-prev': "Previous",
                'btn-next': "Next",
                'about-you': "About You",
                'report-title': "Assessment Report",
                'label-report-date': "Date:",
                'label-patient-name': "Patient Name",
                'label-category': "Category",
                'label-total-amount': "Total Amount:",
                'btn-buy-now': "Buy Now",
                'currency-symbol': "Rs.",
                'timeline-goal': 'Start Seeing Results In <span class="highlight-text">6 Months</span>',
                'redirecting': "Redirecting...",
                'reviews-title': "Customer Reviews",
                'verifying': "Verifying...",
                'great-job': "Great Job!",
                'thank-you-msg': "Thank you for completing the assessment.<br>We are now generating your personalized report.",
            },
            'hi': {
                'btn-prev': "पिछला",
                'btn-next': "अगला",
                'about-you': "आपके बारे में",
                'report-title': "आकलन रिपोर्ट",
                'label-report-date': "दिनांक:",
                'label-patient-name': "रोगी का नाम",
                'label-category': "श्रेणी",
                'label-total-amount': "कुल राशि:",
                'btn-buy-now': "अभी खरीदें",
                'currency-symbol': "रु.",
                'timeline-goal': '<span class="highlight-text">6 महीनों</span> में परिणाम देखना शुरू करें',
                'redirecting': "अनुप्रेषण (Redirecting)...",
                'reviews-title': "ग्राहकों की समीक्षा",
                'verifying': "सत्यापित किया जा रहा है...",
                'great-job': "बहुत बढ़िया!",
                'thank-you-msg': "प्रश्नावली को पूरा करने के लिए धन्यवाद।<br>हम अब आपकी व्यक्तिगत रिपोर्ट तैयार कर रहे हैं।",
            }
        };

        this.init();
    }

    async init() {
        console.log('QuestionnaireEngine: Starting init...');
        this.updateTranslations();

        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
        document.getElementById('about-you-form')?.addEventListener('submit', (e) => e.preventDefault());
        document.getElementById('health-metrics-form')?.addEventListener('submit', (e) => e.preventDefault());

        document.querySelectorAll('.otp-input-group input').forEach((input, index) => {
            this.setupOtpInputEvents(input, index);
        });

        // Check for active session
        let savedState = null;
        try {
            savedState = localStorage.getItem(`active_session_state_${this.config.id}`);
        } catch (e) {
            console.warn('QuestionnaireEngine: localStorage access blocked for session recovery.');
        }

        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed && parsed.currentStep > 1) {
                    console.log('QuestionnaireEngine: Restoring state from localStorage', parsed.currentStep);
                    this.state = { ...this.state, ...parsed };
                    this.showStep(this.state.currentStep);
                    return;
                }
            } catch (e) { console.error("QuestionnaireEngine: Error parsing local state:", e); }
        }

        if (this.db) {
            try {
                await this.loadState();
            } catch (e) {
                console.error("QuestionnaireEngine: Error loading state from DB:", e);
            }
        }
        
        console.log('QuestionnaireEngine: Showing initial step', this.state.currentStep);
        this.showStep(this.state.currentStep);
    }

    async handleGlobalClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        e.preventDefault();

        if (action === 'select-concern') {
            this.handleConcernSelection(target.dataset.concernKey);
        } else if (action === 'prev') {
            this.showStep(parseInt(target.dataset.step, 10));
        } else if (action === 'start') {
            this.showStep(2);
        } else if (action === 'validate-user-info') {
            this.validateUserInfo();
        } else if (action === 'prev-to-user-info') {
            this.switchForm(true);
        } else if (action === 'validate-metrics') {
            this.validateHealthMetrics();
        } else if (action === 'answer-question') {
            this.handleAnswer(target.dataset);
        } else if (action === 'submit-multi-select') {
            this.handleMultiSelectSubmit();
        } else if (action === 'prev-question') {
            this.prevQuestion();
        } else if (action === 'load-youtube') {
            this.loadYoutubeVideo(target);
        } else if (action === 'open-otp') {
            this.openOtpPopup();
        } else if (action === 'close-otp') {
            this.closeOtpPopup();
        } else if (action === 'send-otp') {
            this.sendOtp();
        } else if (action === 'resend-otp') {
            this.resendOtp();
        } else if (action === 'verify-otp') {
            this.verifyOtpFromInputs();
        } else if (action === 'show-previous') {
            this.handleShowPreviousReport();
        } else if (action === 'go-back-from-results') {
            this.showStep(1);
        } else if (action === 'change-lang') {
            this.changeLanguage(target.dataset.lang);
        } else if (action === 'buy-now') {
            await this.buyNow();
        }
    }

    changeLanguage(lang) {
        if (this.currentLanguage === lang) return;
        this.currentLanguage = lang;
        localStorage.setItem(`selected_lang_${this.config.id}`, lang);
        
        this.updateStaticUI();
        this.updateLanguageToggle();
        
        if (this.state.currentStep === 99) {
            this.renderResults();
        } else if (this.state.currentStep >= 3) {
            const group = this.config.questionGroups.find(g => g.step === this.state.currentStep);
            if (group) this.renderQuestionGroup(group);
        } else {
            this.showStep(this.state.currentStep);
        }
    }

    updateStaticUI(scope = document) {
        const langData = this.uiTranslations[this.currentLanguage];
        if (!langData) return;

        scope.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const translation = langData[key];
            if (translation) {
                if (el.tagName === 'INPUT') {
                    el.placeholder = translation;
                } else {
                    el.innerHTML = translation;
                }
            }
        });
    }

    updateLanguageToggle() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLanguage);
        });
    }

    switchForm(showUserInfo) {
        const infoSection = document.getElementById('user-info-section');
        const metricsSection = document.getElementById('metrics-section');
        if (infoSection) infoSection.style.display = showUserInfo ? 'block' : 'none';
        if (metricsSection) metricsSection.style.display = showUserInfo ? 'none' : 'block';
        this.scrollToTopIfMobile();
    }

    showStep(step) {
        this.state.currentStep = step;
        this.saveLocalState();
        const questionnaireEl = document.getElementById('questionnaire');
        if (questionnaireEl) {
            if (step === 99) {
                questionnaireEl.classList.add('full-screen-results', 'results-mode');
            } else {
                questionnaireEl.classList.remove('full-screen-results', 'results-mode');
            }
        }

        document.querySelectorAll('.step').forEach((s) => s.classList.remove('active'));
        
        const header = document.querySelector('#questionnaire .header');
        if (header) header.style.display = step === 1 ? 'block' : 'none';

        if (step === 1) {
            document.getElementById('step-1')?.classList.add('active');
            const nav = document.getElementById('question-navigation');
            if (nav) nav.style.display = 'none';
        } else if (step === 99) {
            document.getElementById('result-page')?.classList.add('active');
            this.renderResults();
        } else {
            const questionGroup = this.config.questionGroups.find((g) => g.step === step);
            if (questionGroup) {
                document.getElementById('step-question')?.classList.add('active');
                this.renderQuestionGroup(questionGroup);
                const nav = document.getElementById('question-navigation');
                if (nav) nav.style.display = 'flex';
            } else {
                document.getElementById(`step-${step}`)?.classList.add('active');
            }
        }

        const lastQuestionStep = this.config.questionGroups.length > 0 ? this.config.questionGroups[this.config.questionGroups.length - 1].step : 2;
        const desktopSteps = document.getElementById('desktop-steps');
        const mobileIndicator = document.getElementById('mobile-step-indicator');

        if (step >= 2 && step <= lastQuestionStep) {
            if (desktopSteps) desktopSteps.style.display = 'flex';
            if (mobileIndicator) mobileIndicator.style.display = 'block';
            this.updateStepIndicators();
        } else {
            if (desktopSteps) desktopSteps.style.display = 'none';
            if (mobileIndicator) mobileIndicator.style.display = 'none';
        }

        this.scrollToTopIfMobile();
        this.persistData();
    }

    handleConcernSelection(concernKey) {
        if (this.config.id !== 'mens-wellness') return;
        this.state.allAnswers.concern = [{ question: "Selected Challenge", text: concernKey.toUpperCase(), score: 0 }];
        const dynamicGroup = this.config.questionGroups.find(g => g.key === 'sexual_health');
        if (dynamicGroup) {
            dynamicGroup.questions = this.config.questionBank[concernKey] || [];
        }
        this.showStep(4);
    }

    updateStepIndicators() {
        const currentGroupConfig = this.progressConfig.find(g => g.step === this.state.currentStep);
        if (!currentGroupConfig) return;

        const totalQuestionsAnsweredInStep = this.state.allAnswers[currentGroupConfig.key]?.length || 0;
        const totalQuestionsInStep = currentGroupConfig.totalQuestions || 1;

        const mobileProgressFill = document.getElementById('mobile-step-progress-fill');
        if (mobileProgressFill) {
            const pct = (totalQuestionsAnsweredInStep / totalQuestionsInStep) * 100;
            mobileProgressFill.style.width = `${pct}%`;
        }

        const desktopContainer = document.getElementById('desktop-steps');
        if (!desktopContainer) return;

        this.progressConfig.forEach((group) => {
            const isCurrent = group.step === this.state.currentStep;
            const isCompleted = group.step < this.state.currentStep;
            let progress = isCompleted ? 100 : (isCurrent ? (this.state.allAnswers[group.key]?.length / (group.totalQuestions || 1)) * 100 : 0);
            
            const fill = document.getElementById(`desktop-progress-fill-${group.id}`);
            if (fill) fill.style.width = `${progress}%`;
            
            const title = desktopContainer.querySelector(`[data-step-id="${group.id}"] .step-title`);
            if (title) title.className = `step-title ${isCurrent ? 'text-primary-blue' : (isCompleted ? 'text-gray-900' : 'text-gray-500')}`;
        });
    }

    renderQuestionGroup(group) {
        const container = document.getElementById('question-content');
        const navContainer = document.getElementById('next-button-container');
        if (!container || !navContainer) return;

        container.innerHTML = '';
        navContainer.innerHTML = '';

        const qIndex = this.state.allAnswers[group.key]?.length || 0;
        if (qIndex >= group.questions.length) {
            this.showStep(this.state.currentStep + 1);
            return;
        }

        const q = group.questions[qIndex];
        const isHi = this.currentLanguage === 'hi';
        const questionText = (isHi && q.hi) ? q.hi : q.question;
        let optionsHTML = '';

        if (q.multiple) {
            optionsHTML = q.options.map((opt) => `
                <label class="multi-option-card">
                    <input type="checkbox" class="multi-checkbox" value="${opt.text}" data-score="${opt.score}">
                    <span class="multi-label">${(isHi && opt.hi) ? opt.hi : opt.text}</span>
                </label>
            `).join('');
            optionsHTML = `<div class="multi-select-container">${optionsHTML}</div>`;
            navContainer.innerHTML = `<button class="next-btn" data-action="submit-multi-select">${this.uiTranslations[this.currentLanguage]['btn-next']}</button>`;
        } else {
            optionsHTML = q.options.map((opt) => `
                <button class="option-button" data-action="answer-question" 
                    data-group-key="${group.key}" data-question="${q.question}" 
                    data-text="${opt.text}" data-score="${opt.score}">
                    ${(isHi && opt.hi) ? opt.hi : opt.text}
                </button>
            `).join('');
            optionsHTML = `<div class="options">${optionsHTML}</div>`;
        }

        container.innerHTML = `<h2>${questionText}</h2>${optionsHTML}`;
        if (q.multiple) this.setupMultiSelectNoneLogic(container);
        this.scrollToTopIfMobile();
    }

    async validateUserInfo() {
        const name = document.getElementById('name').value.trim();
        const dob = document.getElementById('dob').value;
        const phone = document.getElementById('phone').value.trim();
        let isValid = true;

        if (!name || !dob || !/^\d{10}$/.test(phone)) isValid = false;

        if (!isValid) {
            this.showNonBlockingMessage("Please fill all fields correctly.");
            return;
        }

        this.state.userInfo = { name, dob, phone };
        
        if (!this.state.partialDocId) {
            const ref = this.db.collection('partial_submissions').doc();
            this.state.partialDocId = ref.id;
            localStorage.setItem(`partialDocId_${this.config.id}`, ref.id);
            try {
                await ref.set({
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    name, dob, phone, status: "incomplete", questionnaireId: this.config.id
                });
            } catch (e) { console.error(e); }
        }

        const metrics = document.getElementById('metrics-section');
        if (metrics) this.switchForm(false);
        else this.showStep(3);
    }

    validateHealthMetrics() {
        const h = parseFloat(document.getElementById('height').value);
        const cw = parseFloat(document.getElementById('currentWeight').value);
        const tw = parseFloat(document.getElementById('targetWeight').value);
        if (!h || !cw || !tw) {
            this.showNonBlockingMessage("Please enter all metrics.");
            return;
        }
        this.state.healthMetrics = { height: h, currentWeight: cw, targetWeight: tw, bmi: parseFloat((cw / ((h / 100) ** 2)).toFixed(1)) };
        this.state.userInfo = { ...this.state.userInfo, ...this.state.healthMetrics };
        this.showStep(3);
    }

    handleAnswer(dataset) {
        const { groupKey, question, text, score } = dataset;
        this.state.allAnswers[groupKey].push({ question, text, score: parseInt(score, 10) });
        this.renderQuestionGroup(this.config.questionGroups.find(g => g.key === groupKey));
        this.persistData();
    }

    handleMultiSelectSubmit() {
        const group = this.config.questionGroups.find(g => g.step === this.state.currentStep);
        const checkboxes = document.querySelectorAll('.multi-checkbox:checked');
        if (checkboxes.length === 0) return;

        let selected = [];
        let totalScore = 0;
        checkboxes.forEach(cb => {
            selected.push(cb.value);
            totalScore += parseInt(cb.dataset.score, 10);
        });

        this.state.allAnswers[group.key].push({
            question: document.querySelector('#question-content h2').innerText,
            text: selected,
            score: totalScore
        });
        this.renderQuestionGroup(group);
        this.persistData();
    }

    prevQuestion() {
        const group = this.config.questionGroups.find(g => g.step === this.state.currentStep);
        if (group && this.state.allAnswers[group.key]?.length > 0) {
            this.state.allAnswers[group.key].pop();
            this.renderQuestionGroup(group);
        } else if (this.state.currentStep > 2) {
            this.showStep(this.state.currentStep - 1);
        }
    }

    scrollToTopIfMobile() {
        if (window.innerWidth < 768) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async finishQuestionnaire() {
        this.showLoader();
        this.state.healthScore = this.config.calculateScore(this.state.allAnswers, this.state.userInfo, this.config);
        this.state.recommendedProducts = this.config.productRules(this.state.healthScore, this.state.allAnswers, this.config.productDatabase, this.state.userInfo, this.config);
        this.state.results = this.config.resultRules(this.state.healthScore, this.state.allAnswers, this.config, this.state.userInfo);
        this.state.reportDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');

        try {
            const finalDocId = await this.config.saveSubmission(this.state, this.db, this.config);
            this.state.finalDocId = finalDocId;
            if (this.state.partialDocId) {
                await this.db.collection('partial_submissions').doc(this.state.partialDocId).delete();
                localStorage.removeItem(`partialDocId_${this.config.id}`);
            }
            localStorage.setItem(`completed_report_${this.config.id}`, JSON.stringify(this.state));
            this.hideLoader();
            this.showStep(99);
        } catch (e) {
            console.error(e);
            this.hideLoader();
            this.showNonBlockingMessage("Error saving report.");
        }
    }

    handleShowPreviousReport() {
        const data = localStorage.getItem(`completed_report_${this.config.id}`);
        if (!data) return;
        this.showLoader();
        setTimeout(() => {
            this.state = JSON.parse(data);
            this.renderResults();
            this.hideLoader();
            this.showStep(99);
        }, 1000);
    }

    renderResults() {
        const langData = this.uiTranslations[this.currentLanguage];
        if (!langData) return;

        const userNameEl = document.getElementById('user-name');
        const userConcernEl = document.getElementById('user-concern');
        const reportDateEl = document.getElementById('report-date');
        const conditionTextEl = document.getElementById('condition-text');
        const patientIdEl = document.getElementById('patient-id');
        const userAgeEl = document.getElementById('user-age');
        const userCategoryEl = document.getElementById('user-category');

        if (userNameEl) userNameEl.innerText = this.state.userInfo.name || "Patient";
        
        if (userAgeEl && this.state.userInfo.dob) {
            const dob = new Date(this.state.userInfo.dob);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
            userAgeEl.innerText = age;
        }

        if (userCategoryEl) userCategoryEl.innerText = this.config.title || "Health Assessment";
        if (userConcernEl) userConcernEl.innerText = this.state.results.issueTitle;
        if (conditionTextEl) conditionTextEl.innerHTML = this.state.results.conditionTextHTML;
        if (reportDateEl) reportDateEl.innerText = this.state.reportDate || new Date().toLocaleDateString('en-GB');

        if (patientIdEl) {
            patientIdEl.innerText = this.state.finalDocId ? `#${this.state.finalDocId.slice(-6).toUpperCase()}` : '#NEW';
        }

        const riskBadge = document.getElementById('risk-level-badge');
        if (riskBadge && typeof this.config.getRiskType === 'function') {
            const riskKey = this.config.getRiskType(this.state.healthScore);
            riskBadge.innerText = riskKey.replace(/-/g, ' ').toUpperCase();
            riskBadge.style.background = this.getScoreColor(this.state.healthScore);
        }

        const riskContainer = document.getElementById('future-risk-tags');
        if (riskContainer) {
            riskContainer.innerHTML = '';
            (this.state.results.futureRisks || []).forEach(risk => {
                riskContainer.innerHTML += `<div class="risk-tag">${risk.text || risk}</div>`;
            });
        }

        this.renderTimeline();
        this.renderProducts();
        this.animateScore(this.state.healthScore);
        this.renderUGCContent();
    }

    renderTimeline() {
        const lang = this.currentLanguage;
        const timelineContainer = document.getElementById('condition-timeline-container');
        if (!timelineContainer) return;
        
        timelineContainer.innerHTML = '';
        const timelineData = this.state.results.timelineData;
        const mainTimelineTitle = document.querySelector('.results-timeline h3');
        const langData = this.uiTranslations[lang];

        if (mainTimelineTitle && langData['timeline-goal']) mainTimelineTitle.innerHTML = langData['timeline-goal'];

        const mergedTimeline = {};
        timelineData.general.forEach((item) => {
            if (!mergedTimeline[item.month]) mergedTimeline[item.month] = { month: item.month, hi: item.hi, general: '', extras: [] };
            mergedTimeline[item.month].general = (lang === 'hi' && item.hiDesc) ? item.hiDesc : item.timelineDesc;
        });

        let timelineHTML = '<div class="timeline-months">';
        const months = Object.keys(mergedTimeline).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

        months.forEach((monthKey, index) => {
            const data = mergedTimeline[monthKey];
            timelineHTML += `
                <div class="month-box">
                    <div class="month-icon"><img src="https://cdn.shopify.com/s/files/1/0924/5687/8383/files/timeline.webp?v=1774248748" /></div>
                    <h4>${(lang === 'hi' && data.hi) ? data.hi : data.month}</h4>
                    <p class="general-desc">${data.general}</p>
                </div>
            `;
            if (index < months.length - 1) timelineHTML += '<div class="line"></div>';
        });

        timelineHTML += '</div>';
        timelineContainer.innerHTML = timelineHTML;
    }

    renderProducts() {
        const lang = this.currentLanguage;
        const langData = this.uiTranslations[lang];
        const productList = document.getElementById('product-list');
        if (!productList) return;
        
        let total = 0;
        productList.innerHTML = '';
        const activeProducts = this.state.recommendedProducts.filter(p => p.active);

        activeProducts.forEach((product) => {
            const hasDiscount = product.regularPrice > product.salePrice;
            const currencySymbol = langData['currency-symbol'] || 'Rs.';
            productList.innerHTML += `
                <div class="product-card" data-action="open-product-modal" data-name="${product.name}" data-price="${currencySymbol}${product.salePrice}" data-image="${product.image}">
                    <img src="${product.image}" alt="${product.name}">
                    <div class="product-name">${product.name}</div>
                    <div class="price-section">
                        ${hasDiscount ? `<span class="old-price">${currencySymbol}${product.regularPrice}</span>` : ''}
                        <span class="new-price">${currencySymbol}${product.salePrice}</span>
                    </div>
                </div>
            `;
            total += product.salePrice;
        });
        document.getElementById('total-amount').textContent = (langData['currency-symbol'] || 'Rs.') + total;
    }

    animateScore(finalScore) {
        let currentScore = 0;
        const progressValue = document.getElementById('progress-value');
        const progressBar = document.getElementById('circular-progress');
        if (!progressValue || !progressBar) return;
        finalScore = Math.max(0, Math.min(100, finalScore));
        const interval = setInterval(() => {
            currentScore++;
            if (currentScore >= finalScore) { currentScore = finalScore; clearInterval(interval); }
            progressValue.innerText = currentScore;
            progressBar.style.background = `conic-gradient(${this.getScoreColor(currentScore)} ${currentScore * 3.6}deg, #f3f4f6 0deg)`;
        }, 15);
    }

    getScoreColor(score) {
        if (score < 50) return 'red';
        if (score < 80) return 'orange';
        return '#4caf50';
    }

    async buyNow() {
        const activeProducts = this.state.recommendedProducts.filter(p => p.active);
        if (activeProducts.length === 0) return;
        const btn = document.querySelector('[data-action="buy-now"]');
        btn.innerText = this.uiTranslations[this.currentLanguage]['redirecting'];
        btn.disabled = true;
        const form = document.createElement('form');
        form.method = 'POST'; form.action = '/cart/add';
        activeProducts.forEach(p => {
            const id = document.createElement('input'); id.type = 'hidden'; id.name = 'id[]'; id.value = Number(p.variantId); form.appendChild(id);
            const qty = document.createElement('input'); qty.type = 'hidden'; qty.name = 'quantity[]'; qty.value = 1; form.appendChild(qty);
        });
        document.body.appendChild(form); form.submit();
    }

    setupOtpInputEvents(input, index) {
        const inputs = document.querySelectorAll(".otp-input-group input");
        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace") { input.value = ""; if (index > 0) inputs[index - 1].focus(); e.preventDefault(); }
        });
        input.addEventListener("input", () => { if (/^\d$/.test(input.value) && index < inputs.length - 1) inputs[index + 1].focus(); });
    }

    openOtpPopup() {
        const modal = document.getElementById("otp-modal");
        this.enteredPhone = this.state.userInfo.phone || "";
        document.getElementById("otp-phone").value = this.enteredPhone;
        document.getElementById("otp-step-1").style.display = "block";
        document.getElementById("otp-step-2").style.display = "none";
        modal.style.display = "flex";
    }

    closeOtpPopup() { document.getElementById("otp-modal").style.display = "none"; clearInterval(this.otpTimer); }

    sendOtp() {
        const phone = document.getElementById("otp-phone").value.trim();
        if (!/^\d{10}$/.test(phone)) return;
        this.enteredPhone = phone;
        fetch("https://generateotp-xrtgefpbxq-em.a.run.app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) })
            .then(() => { document.getElementById("otp-step-1").style.display = "none"; document.getElementById("otp-step-2").style.display = "block"; this.startOtpTimer(); });
    }

    startOtpTimer() {
        this.otpExpiresAt = Date.now() + 60000;
        this.otpTimer = setInterval(() => {
            const left = Math.max(0, Math.floor((this.otpExpiresAt - Date.now()) / 1000));
            const btn = document.querySelector('[data-action="resend-otp"]');
            if (btn) btn.innerText = `Resend OTP in ${left}s`;
            if (left <= 0) { clearInterval(this.otpTimer); if (btn) { btn.innerText = "Resend OTP"; btn.disabled = false; } }
        }, 1000);
    }

    async verifyOtpFromInputs() {
        const digits = Array.from(document.querySelectorAll(".otp-input-group input")).map(i => i.value).join("");
        if (digits.length < 6) return;
        const response = await fetch("https://verifyotp-xrtgefpbxq-em.a.run.app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: this.enteredPhone, otp: digits }) });
        const data = await response.json();
        if (data.success) { window.open(`https://wa.me/919355539355?text=I want my detailed healthscore360 report`, '_blank'); this.closeOtpPopup(); }
    }

    renderUGCContent() {
        const container = document.getElementById('ugc-content');
        if (!container) return;
        container.innerHTML = `<h3 data-i18n="reviews-title">${this.uiTranslations[this.currentLanguage]['reviews-title']}</h3><div class="ugc-slider">${['68SbZuINym0', 'EyvZLDLxFYU', 'i_lfAg9o4HA'].map(id => `<div class="ugc-slide" data-action="load-youtube" data-src="https://www.youtube.com/embed/${id}"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" class="ugc-thumbnail"></div>`).join('')}</div>`;
        container.style.display = 'block';
    }

    loadYoutubeVideo(target) {
        const slide = target.closest('.ugc-slide');
        if (!slide) return;
        slide.innerHTML = `<iframe src="${slide.dataset.src}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }

    persistData() {
        if (!this.state.partialDocId) return;
        const ref = this.db.collection('partial_submissions').doc(this.state.partialDocId);
        const data = { ...this.state, lastUpdated: new Date() };
        delete data.config; delete data.results; delete data.healthScore;
        ref.set(data, { merge: true }).catch(e => console.error(e));
    }

    saveLocalState() {
        const s = { ...this.state }; delete s.config;
        localStorage.setItem(`active_session_state_${this.config.id}`, JSON.stringify(s));
    }

    async loadState() {
        try {
            const id = localStorage.getItem(`partialDocId_${this.config.id}`);
            if (!id) return;
            const snap = await this.db.collection('partial_submissions').doc(id).get();
            if (snap.exists) this.state = { ...this.state, ...snap.data() };
        } catch (e) {
            console.error("QuestionnaireEngine: Error in loadState:", e);
        }
    }

    showNonBlockingMessage(msg) { alert(msg); }
    showLoader() { document.getElementById('loader').style.display = 'flex'; }
    hideLoader() { document.getElementById('loader').style.display = 'none'; }
    setupMultiSelectNoneLogic(container) {
        const cbs = container.querySelectorAll('.multi-checkbox');
        cbs.forEach(cb => cb.addEventListener('change', (e) => {
            if (e.target.value.toLowerCase() === 'none' && e.target.checked) cbs.forEach(c => { if (c !== e.target) c.checked = false; });
            else if (e.target.checked) cbs.forEach(c => { if (c.value.toLowerCase() === 'none') c.checked = false; });
        }));
    }

}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded: Initializing Questionnaire...');
    if (typeof questionnaireConfig !== 'undefined') {
        window.myQuestionnaire = new QuestionnaireEngine(questionnaireConfig);
        window.myQuestionnaire.init().catch(err => {
            console.error('QuestionnaireEngine: Init failed:', err);
        });
    } else {
        console.error('DOMContentLoaded: questionnaireConfig not found!');
    }
});