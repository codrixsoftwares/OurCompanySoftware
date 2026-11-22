import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getCollections } from '../../core/mongodb.js';
import { uploadToCloudinary } from '../../core/cloudinary.js';
import { triggerStageJourneyEmail } from '../recruitment/recruitmentRoutes.js';
import { SocketService } from '../../core/socket/socketService.js';

const router = Router();

// GET /api/v1/public/jobs (Public directory of OPEN vacancies for codrix.co.in)
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const jobs = await cols.jobOpenings.find({ status: 'OPEN' }).sort({ createdAt: -1 }).toArray();
    res.json({
      success: true,
      count: jobs.length,
      data: jobs.map((j) => ({
        id: j._id.toString(),
        title: j.title,
        requisitionCode: j.requisitionCode,
        department: j.departmentId,
        openingType: j.openingType || 'Full-time',
        workplaceMode: j.workplaceMode || 'Hybrid',
        experienceLevel: j.experienceLevel || '1-3 Years',
        headcount: j.headcount,
        location: j.location,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        skills: j.skills,
        description: j.description,
        createdAt: j.createdAt
      }))
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/public/jobs/:id (Public details for single job)
router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const cols = getCollections();
    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(req.params.id) });
    if (!job || job.status !== 'OPEN') {
      res.status(404).json({ success: false, error: 'Job opening not found or currently closed.' });
      return;
    }
    res.json({
      success: true,
      data: {
        id: job._id.toString(),
        title: job.title,
        requisitionCode: job.requisitionCode,
        department: job.departmentId,
        openingType: job.openingType || 'Full-time',
        workplaceMode: job.workplaceMode || 'Hybrid',
        experienceLevel: job.experienceLevel || '1-3 Years',
        headcount: job.headcount,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        skills: job.skills,
        description: job.description
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/public/jobs/:id/apply (Public candidate intake from codrix.co.in)
router.post('/jobs/:id/apply', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const { fullName, email, phone, coverLetter, resumeBase64, resumeUrl: directResumeUrl, source = 'codrix.co.in' } = req.body;
    const cols = getCollections();

    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(jobId) });
    if (!job) {
      res.status(404).json({ success: false, error: 'Job opening not found.' });
      return;
    }

    if (!fullName || !fullName.trim()) {
      res.status(400).json({ success: false, error: 'Full name is required.' });
      return;
    }

    if (!email || !email.trim() || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email address is required.' });
      return;
    }

    const tenantId = job.tenantId;
    const normalizedEmail = email.toLowerCase().trim();

    let uploadedResumeUrl = directResumeUrl;
    if (resumeBase64) {
      try {
        uploadedResumeUrl = await uploadToCloudinary(resumeBase64, 'resumes');
      } catch (uploadErr) {
        console.warn('Cloudinary resume upload failed during public apply:', uploadErr);
      }
    }

    let candidate = await cols.candidates.findOne({ tenantId, emailNormalized: normalizedEmail });
    if (!candidate) {
      const existingCount = await cols.candidates.countDocuments({ tenantId });
      const serialNo = existingCount + 1;
      const requestNo = `REQ-${serialNo.toString().padStart(4, '0')}`;

      const candDoc = {
        tenantId,
        serialNo,
        requestNo,
        fullName: fullName.trim(),
        emailNormalized: normalizedEmail,
        phoneNormalized: phone ? phone.trim() : '',
        source: `WEBSITE_${source}`,
        resumeUrl: uploadedResumeUrl,
        notes: coverLetter,
        journeyEmailsSent: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const candRes = await cols.candidates.insertOne(candDoc);
      candidate = { ...candDoc, _id: candRes.insertedId };
    }

    const candidateId = candidate._id.toString();
    const serialNo = candidate.serialNo || (await cols.candidates.countDocuments({ tenantId }));
    const requestNo = candidate.requestNo || `REQ-${serialNo.toString().padStart(4, '0')}`;

    // Default stage is Sourced
    let defaultStage = await cols.pipelineStages.findOne({ tenantId }, { sort: { stageOrder: 1 } });
    if (!defaultStage) {
      const stageRes = await cols.pipelineStages.insertOne({
        tenantId,
        name: 'Sourced',
        stageOrder: 1,
        isSystem: true,
        createdAt: new Date()
      });
      defaultStage = { _id: stageRes.insertedId, name: 'Sourced' } as any;
    }

    const appDoc = {
      tenantId,
      candidateId,
      serialNo,
      requestNo,
      jobOpeningId: jobId,
      stageId: defaultStage!._id.toString(),
      status: 'ACTIVE',
      appliedAt: new Date(),
      updatedAt: new Date()
    };
    const appRes = await cols.applications.insertOne(appDoc);
    const applicationId = appRes.insertedId.toString();

    // Automatically trigger Sourced stage candidate journey email
    await triggerStageJourneyEmail(applicationId, defaultStage!.name || 'Sourced', cols, tenantId);

    // Emit live Socket.IO update to all connected recruiter sessions!
    SocketService.emitToTenant(tenantId, 'recruitment:candidate_new', {
      candidateId,
      applicationId,
      jobId,
      serialNo,
      requestNo,
      fullName: candidate.fullName
    });

    res.status(201).json({
      success: true,
      message: `Thank you, ${fullName}! Your application for ${job.title} has been received. Please check your inbox (${normalizedEmail}) for confirmation.`,
      data: {
        applicationId,
        serialNo,
        requestNo,
        requisitionCode: requestNo,
        status: 'SOURCED'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/public/jobs/:id/embed.js (Auto-generated Embeddable Webscript for codrix.co.in)
router.get('/jobs/:id/embed.js', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    const cols = getCollections();
    const job = await cols.jobOpenings.findOne({ _id: new ObjectId(jobId) });
    const apiHost = req.protocol + '://' + req.get('host');

    const script = `
(function() {
  var container = document.getElementById('codrix-careers-container') || document.querySelector('[data-codrix-job="${jobId}"]') || document.body;
  if (!container) return;

  var widgetDiv = document.createElement('div');
  widgetDiv.className = 'codrix-apply-card';
  widgetDiv.style.cssText = 'max-width: 520px; margin: 16px auto; padding: 24px; border: 1px solid #E7E0FB; border-radius: 16px; background: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-shadow: 0 4px 12px rgba(124, 44, 245, 0.08);';

  widgetDiv.innerHTML = \`
    <div style="margin-bottom: 18px; border-bottom: 1px solid #E7E0FB; padding-bottom: 12px;">
      <h3 style="margin: 0; color: #120E24; font-size: 18px; font-weight: 700;">Apply for ${job?.title || 'Open Role'}</h3>
      <div style="color: #7C2CF5; font-size: 12px; font-weight: 600; margin-top: 4px;">CodRix Private Limited • ${job?.requisitionCode || 'REQ'} • ${job?.location || 'India'}</div>
    </div>
    <form id="codrix-apply-form" style="display: flex; flex-direction: column; gap: 12px;">
      <div>
        <label style="display: block; font-size: 12px; font-weight: 600; color: #120E24; margin-bottom: 4px;">Full Name *</label>
        <input type="text" name="fullName" required placeholder="Your full name" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #E7E0FB; border-radius: 10px; font-size: 13px; background: #FBFBFE;" />
      </div>
      <div>
        <label style="display: block; font-size: 12px; font-weight: 600; color: #120E24; margin-bottom: 4px;">Email Address *</label>
        <input type="email" name="email" required placeholder="your.email@example.com" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #E7E0FB; border-radius: 10px; font-size: 13px; background: #FBFBFE;" />
      </div>
      <div>
        <label style="display: block; font-size: 12px; font-weight: 600; color: #120E24; margin-bottom: 4px;">Phone Number</label>
        <input type="tel" name="phone" placeholder="+91 9876543210" style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #E7E0FB; border-radius: 10px; font-size: 13px; background: #FBFBFE;" />
      </div>
      <div>
        <label style="display: block; font-size: 12px; font-weight: 600; color: #120E24; margin-bottom: 4px;">Cover Note / Key Strengths</label>
        <textarea name="coverLetter" rows="3" placeholder="Briefly describe your experience and passion for this role..." style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #E7E0FB; border-radius: 10px; font-size: 13px; background: #FBFBFE; resize: vertical;"></textarea>
      </div>
      <div id="codrix-form-msg" style="display: none; padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 600;"></div>
      <button type="submit" id="codrix-submit-btn" style="padding: 12px; background: #7C2CF5; color: #FFFFFF; font-weight: 700; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; transition: background 0.2s;">
        Submit Application
      </button>
    </form>
  \`;

  container.appendChild(widgetDiv);

  var form = widgetDiv.querySelector('#codrix-apply-form');
  var btn = widgetDiv.querySelector('#codrix-submit-btn');
  var msg = widgetDiv.querySelector('#codrix-form-msg');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    btn.disabled = true;
    btn.innerText = 'Submitting Application...';
    msg.style.display = 'none';

    var payload = {
      fullName: form.fullName.value,
      email: form.email.value,
      phone: form.phone.value,
      coverLetter: form.coverLetter.value,
      source: window.location.hostname || 'codrix.co.in'
    };

    fetch('${apiHost}/api/v1/public/jobs/${jobId}/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        form.innerHTML = '<div style="text-align: center; padding: 20px 0;"><div style="color: #10B981; font-size: 32px; margin-bottom: 8px;">✓</div><h4 style="margin: 0 0 8px; color: #120E24;">Application Received!</h4><p style="color: #585172; font-size: 13px; margin: 0;">' + data.message + '</p></div>';
      } else {
        msg.style.display = 'block';
        msg.style.background = '#FEE2E2';
        msg.style.color = '#991B1B';
        msg.innerText = data.error || 'Failed submitting application.';
        btn.disabled = false;
        btn.innerText = 'Submit Application';
      }
    })
    .catch(function(err) {
      msg.style.display = 'block';
      msg.style.background = '#FEE2E2';
      msg.style.color = '#991B1B';
      msg.innerText = 'Network error. Please try again.';
      btn.disabled = false;
      btn.innerText = 'Submit Application';
    });
  });
})();
`;

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
  } catch (err: any) {
    res.status(500).send('console.error("CodRix Embed Error: ' + err.message + '");');
  }
});

export default router;
