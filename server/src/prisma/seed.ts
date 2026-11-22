import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Codrix comprehensive demo database seeding...');

  // 1. Clean existing records
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dailyUpdate.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskStatusHistory.deleteMany();
  await prisma.bug.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sprint.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.callActivity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.emailRecordLink.deleteMany();
  await prisma.emailNote.deleteMany();
  await prisma.emailMessage.deleteMany();
  await prisma.emailThread.deleteMany();
  await prisma.mailboxGrant.deleteMany();
  await prisma.mailboxConnection.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.interviewFeedback.deleteMany();
  await prisma.interviewParticipant.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.applicationStageHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobOpening.deleteMany();
  await prisma.userRoleAssignment.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  // 2. Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      slug: 'codrix-demo',
      legalName: 'Codrix Technologies Private Limited',
      displayName: 'Codrix Tech',
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata'
    }
  });

  // 3. Departments & Branches
  const deptEngineering = await prisma.department.create({
    data: { tenantId: tenant.id, name: 'Engineering & Product', code: 'ENG' }
  });
  const deptHR = await prisma.department.create({
    data: { tenantId: tenant.id, name: 'Talent & Human Resources', code: 'HR' }
  });
  const deptSales = await prisma.department.create({
    data: { tenantId: tenant.id, name: 'Business Development & Sales', code: 'SALES' }
  });
  const deptOps = await prisma.department.create({
    data: { tenantId: tenant.id, name: 'Operations & Delivery', code: 'OPS' }
  });

  const branchHQ = await prisma.branch.create({
    data: { tenantId: tenant.id, name: 'Bangalore Innovation Hub', code: 'BLR-01', city: 'Bangalore', country: 'India' }
  });

  // 4. Roles
  const roleCodes = [
    { code: 'SUPER_ADMIN', name: 'Platform Super Admin', desc: 'Platform overseer' },
    { code: 'COMPANY_ADMIN', name: 'Company Admin', desc: 'Full tenant organization control' },
    { code: 'HR_MANAGER', name: 'HR Manager', desc: 'Recruitment and human resources management' },
    { code: 'HR_EXEC', name: 'HR Executive', desc: 'Recruiter and employee operations' },
    { code: 'BRANCH_MANAGER', name: 'Branch Manager', desc: 'Regional branch supervisor' },
    { code: 'OPS_MANAGER', name: 'Operations Manager', desc: 'Operations and staffing' },
    { code: 'BDM', name: 'Business Development Manager', desc: 'Sales pipeline manager' },
    { code: 'BDE', name: 'Business Development Executive', desc: 'Lead generation and sales execution' },
    { code: 'ENGINEERING_LEAD', name: 'Engineering Lead', desc: 'Technical architecture and sprint planner' },
    { code: 'SDE2', name: 'Software Engineer II', desc: 'Senior software developer' },
    { code: 'SDE1', name: 'Software Engineer I', desc: 'Core software developer' },
    { code: 'INTERN', name: 'Engineering Intern', desc: 'Learner and task contributor' },
    { code: 'EMPLOYEE', name: 'General Employee', desc: 'Standard employee portal access' }
  ];

  const rolesMap = new Map<string, any>();
  for (const r of roleCodes) {
    const roleRecord = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        code: r.code,
        name: r.name,
        isSystem: true,
        description: r.desc
      }
    });
    rolesMap.set(r.code, roleRecord);
  }

  // Common password hash for test accounts: "Password123!"
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 5. Create Core Demo Users across key roles
  const seedUsers = [
    { email: 'admin@codrix.co.in', name: 'Arjun Mehta', role: 'COMPANY_ADMIN', title: 'Managing Director & Admin', dept: deptOps.id, code: 'CDX-001' },
    { email: 'hr.manager@codrix.co.in', name: 'Pooja Sharma', role: 'HR_MANAGER', title: 'Head of People & Culture', dept: deptHR.id, code: 'CDX-002' },
    { email: 'hr.exec@codrix.co.in', name: 'Rohit Verma', role: 'HR_EXEC', title: 'Talent Acquisition Executive', dept: deptHR.id, code: 'CDX-003' },
    { email: 'bdm@codrix.co.in', name: 'Sneha Patel', role: 'BDM', title: 'VP of Business Development', dept: deptSales.id, code: 'CDX-004' },
    { email: 'bde@codrix.co.in', name: 'Karan Malhotra', role: 'BDE', title: 'Business Development Executive', dept: deptSales.id, code: 'CDX-005' },
    { email: 'eng.lead@codrix.co.in', name: 'Vikram Joshi', role: 'ENGINEERING_LEAD', title: 'Principal Engineering Lead', dept: deptEngineering.id, code: 'CDX-006' },
    { email: 'sde2@codrix.co.in', name: 'Ananya Rao', role: 'SDE2', title: 'Senior Full Stack Engineer', dept: deptEngineering.id, code: 'CDX-007' },
    { email: 'sde1@codrix.co.in', name: 'Rohan Gupta', role: 'SDE1', title: 'Software Development Engineer', dept: deptEngineering.id, code: 'CDX-008' },
    { email: 'intern@codrix.co.in', name: 'Deepak Nayak', role: 'INTERN', title: 'Software Engineering Intern', dept: deptEngineering.id, code: 'CDX-009' }
  ];

  const employeesMap = new Map<string, any>();

  for (const su of seedUsers) {
    const user = await prisma.user.create({
      data: {
        primaryEmail: su.email,
        passwordHash,
        fullName: su.name,
        status: 'ACTIVE'
      }
    });

    const membership = await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        status: 'ACTIVE'
      }
    });

    const roleRec = rolesMap.get(su.role);
    if (roleRec) {
      await prisma.userRoleAssignment.create({
        data: {
          membershipId: membership.id,
          roleId: roleRec.id
        }
      });
    }

    const employee = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        membershipId: membership.id,
        employeeCode: su.code,
        jobTitle: su.title,
        departmentId: su.dept,
        branchId: branchHQ.id,
        employmentStatus: 'ACTIVE'
      }
    });

    employeesMap.set(su.email, employee);
  }

  // 6. Pipeline Stages for Recruitment
  const stageNames = ['Sourced', 'Screened', 'Technical Interview', 'Executive Review', 'Offer Extended', 'Hired'];
  const stagesMap = new Map<string, any>();
  for (let i = 0; i < stageNames.length; i++) {
    const stage = await prisma.pipelineStage.create({
      data: {
        tenantId: tenant.id,
        name: stageNames[i],
        stageOrder: i + 1,
        isSystem: true
      }
    });
    stagesMap.set(stageNames[i], stage);
  }

  // 7. Recruitment Job Openings & Candidates
  const jobOpening1 = await prisma.jobOpening.create({
    data: {
      tenantId: tenant.id,
      requisitionCode: 'REQ-0001',
      title: 'Senior Full Stack Engineer (React/Node.js)',
      departmentId: deptEngineering.id,
      headcount: 2,
      description: 'Looking for experienced TypeScript/Node.js engineers to build multi-tenant SaaS features.',
      skills: 'React, Node.js, TypeScript, PostgreSQL, Prisma',
      salaryMin: 1800000,
      salaryMax: 2600000,
      location: 'Bangalore (Hybrid)',
      status: 'OPEN'
    }
  });

  const jobOpening2 = await prisma.jobOpening.create({
    data: {
      tenantId: tenant.id,
      requisitionCode: 'REQ-0002',
      title: 'Enterprise BDE (SaaS Solutions)',
      departmentId: deptSales.id,
      headcount: 3,
      description: 'Drive high-value enterprise B2B sales pipelines and client partnerships.',
      skills: 'B2B Sales, CRM, Cold Calling, Pipeline Management',
      salaryMin: 800000,
      salaryMax: 1400000,
      location: 'Bangalore',
      status: 'OPEN'
    }
  });

  const candidate1 = await prisma.candidate.create({
    data: {
      tenantId: tenant.id,
      fullName: 'Aakash Singhal',
      emailNormalized: 'aakash.singhal@example.com',
      phoneNormalized: '+91 9876543210',
      source: 'LINKEDIN',
      notes: '5 years React & Express experience. Strong architecture fundamentals.'
    }
  });

  const candidate2 = await prisma.candidate.create({
    data: {
      tenantId: tenant.id,
      fullName: 'Meera Iyer',
      emailNormalized: 'meera.iyer@example.com',
      phoneNormalized: '+91 9811223344',
      source: 'REFERRAL',
      notes: 'Excellent B2B sales track record in tech products.'
    }
  });

  const app1 = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      candidateId: candidate1.id,
      jobOpeningId: jobOpening1.id,
      stageId: stagesMap.get('Technical Interview').id,
      status: 'ACTIVE'
    }
  });

  const app2 = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      candidateId: candidate2.id,
      jobOpeningId: jobOpening2.id,
      stageId: stagesMap.get('Screened').id,
      status: 'ACTIVE'
    }
  });

  await prisma.interview.create({
    data: {
      tenantId: tenant.id,
      applicationId: app1.id,
      title: 'System Design & Code Pairing Round',
      scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
      durationMinutes: 60,
      meetingLink: 'https://meet.google.com/cdx-tech-interview',
      status: 'SCHEDULED'
    }
  });

  // 8. Mailboxes (Shared & Individual)
  const mbCareers = await prisma.mailboxConnection.create({
    data: {
      tenantId: tenant.id,
      provider: 'GOOGLE',
      mailboxAddress: 'careers@codrix.co.in',
      mailboxType: 'SHARED',
      displayName: 'Codrix Careers Desk',
      connectionStatus: 'CONNECTED'
    }
  });

  const mbSales = await prisma.mailboxConnection.create({
    data: {
      tenantId: tenant.id,
      provider: 'GOOGLE',
      mailboxAddress: 'sales@codrix.co.in',
      mailboxType: 'SHARED',
      displayName: 'Enterprise Sales Team',
      connectionStatus: 'CONNECTED'
    }
  });

  const mbConnect = await prisma.mailboxConnection.create({
    data: {
      tenantId: tenant.id,
      provider: 'GOOGLE',
      mailboxAddress: 'connect@codrix.co.in',
      mailboxType: 'SHARED',
      displayName: 'General Inquiries',
      connectionStatus: 'CONNECTED'
    }
  });

  // Email Threads
  const thread1 = await prisma.emailThread.create({
    data: {
      tenantId: tenant.id,
      mailboxConnectionId: mbCareers.id,
      providerThreadId: 'th_demo_01',
      subject: 'Application for Senior Full Stack Engineer - Aakash Singhal',
      snippet: 'Dear Hiring Team, I am submitting my portfolio and resume for your Senior Full Stack opening...',
      folder: 'INBOX',
      unread: true,
      lastMessageAt: new Date()
    }
  });

  await prisma.emailMessage.create({
    data: {
      tenantId: tenant.id,
      threadId: thread1.id,
      providerMessageId: 'msg_demo_01',
      direction: 'INBOUND',
      sender: 'aakash.singhal@example.com',
      recipientsJson: JSON.stringify({ to: ['careers@codrix.co.in'] }),
      subject: 'Application for Senior Full Stack Engineer - Aakash Singhal',
      body: 'Dear Hiring Team,\n\nI am thrilled to apply for the Senior Full Stack Engineer role at Codrix. My background includes building high-scale multi-tenant applications in React and Node.js.\n\nLooking forward to speaking with you.\n\nBest regards,\nAakash Singhal',
      sentAt: new Date(Date.now() - 3600000)
    }
  });

  const thread2 = await prisma.emailThread.create({
    data: {
      tenantId: tenant.id,
      mailboxConnectionId: mbSales.id,
      providerThreadId: 'th_demo_02',
      subject: 'Enterprise SaaS Evaluation Inquiry - Nexus Infotech',
      snippet: 'Hello Codrix Sales, We would like to schedule a product demo for 150 team seats...',
      folder: 'INBOX',
      unread: true,
      lastMessageAt: new Date()
    }
  });

  await prisma.emailMessage.create({
    data: {
      tenantId: tenant.id,
      threadId: thread2.id,
      providerMessageId: 'msg_demo_02',
      direction: 'INBOUND',
      sender: 'procurement@nexusinfo.com',
      recipientsJson: JSON.stringify({ to: ['sales@codrix.co.in'] }),
      subject: 'Enterprise SaaS Evaluation Inquiry - Nexus Infotech',
      body: 'Hi Codrix Team,\n\nWe are looking to migrate our operations to a unified platform. Can you arrange a demonstration this week for our executive committee?\n\nThanks,\nRajesh Nair, VP Ops, Nexus Infotech',
      sentAt: new Date(Date.now() - 7200000)
    }
  });

  // 9. CRM Leads & Opportunities
  const lead1 = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      companyName: 'Nexus Infotech Solutions',
      contactName: 'Rajesh Nair',
      email: 'procurement@nexusinfo.com',
      phone: '+91 9988776655',
      ownerEmployeeId: employeesMap.get('bde@codrix.co.in').id,
      stage: 'QUALIFIED',
      source: 'INBOUND_EMAIL',
      serviceInterest: 'Enterprise Multi-Tenant Workspace',
      needSummary: 'Unified ATS, HRMS, and engineering operations for 150 employees.',
      priority: 'HIGH'
    }
  });

  await prisma.callActivity.create({
    data: {
      tenantId: tenant.id,
      leadId: lead1.id,
      actorUserId: 'Karan Malhotra',
      outcome: 'CONNECTED',
      summary: 'Initial discovery call with VP Ops. Outlined pricing structure and implementation timeline.',
      pitchFeedback: 'Very receptive to shared mailbox & customer 360 features.',
      durationSeconds: 420
    }
  });

  await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: lead1.id,
      ownerEmployeeId: employeesMap.get('bde@codrix.co.in').id,
      dueAt: new Date(Date.now() + 172800000), // In 2 days
      channel: 'MEETING',
      priority: 'HIGH',
      status: 'PENDING'
    }
  });

  // 10. Engineering Projects, Sprints & Tasks
  const project1 = await prisma.project.create({
    data: {
      tenantId: tenant.id,
      projectCode: 'PRJ-001',
      name: 'Codrix Core Platform v1.0',
      description: 'Building multi-tenant architecture, role governance, and domain modules.',
      status: 'ACTIVE',
      managerEmployeeId: employeesMap.get('eng.lead@codrix.co.in').id
    }
  });

  const sprint1 = await prisma.sprint.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      name: 'Sprint 14: Domain Unification',
      goal: 'Deliver ATS Kanban pipeline, shared mailbox concurrency guard, and Customer 360 view.',
      startDate: new Date(Date.now() - 604800000),
      endDate: new Date(Date.now() + 604800000),
      status: 'ACTIVE'
    }
  });

  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      sprintId: sprint1.id,
      taskCode: 'TSK-001',
      title: 'Implement ABAC data scope policy engine',
      description: 'Enforce OWN, TEAM, DEPARTMENT, BRANCH, and COMPANY constraints on record queries.',
      priority: 'URGENT',
      estimateHours: 8,
      status: 'DONE',
      assigneeEmployeeId: employeesMap.get('sde2@codrix.co.in').id
    }
  });

  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      sprintId: sprint1.id,
      taskCode: 'TSK-002',
      title: 'Build shared mailbox reply lock and audit log',
      description: 'Ensure race-condition safety when multiple recruiters or sales execs reply to shared threads.',
      priority: 'HIGH',
      estimateHours: 6,
      status: 'IN_PROGRESS',
      assigneeEmployeeId: employeesMap.get('sde1@codrix.co.in').id
    }
  });

  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      projectId: project1.id,
      sprintId: sprint1.id,
      taskCode: 'TSK-003',
      title: 'Customer 360 aggregate timeline view',
      description: 'Integrate leads, call logs, opportunities, and projects in single dashboard tab.',
      priority: 'MEDIUM',
      estimateHours: 5,
      status: 'TODO',
      assigneeEmployeeId: employeesMap.get('intern@codrix.co.in').id
    }
  });

  // 11. HRMS Leave Types & Balances
  const leaveTypes = [
    { name: 'Paid Leave', code: 'PL', days: 18 },
    { name: 'Casual Leave', code: 'CL', days: 12 },
    { name: 'Sick Leave', code: 'SL', days: 10 }
  ];

  for (const lt of leaveTypes) {
    const leaveType = await prisma.leaveType.create({
      data: {
        tenantId: tenant.id,
        name: lt.name,
        code: lt.code,
        defaultDaysPerYear: lt.days
      }
    });

    for (const [_, emp] of employeesMap.entries()) {
      await prisma.leaveBalance.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          totalDays: lt.days,
          usedDays: 2.0,
          pendingDays: 0.0
        }
      });
    }
  }

  // Sample Leave Request
  const paidLeave = await prisma.leaveType.findFirst({ where: { tenantId: tenant.id, code: 'PL' } });
  if (paidLeave) {
    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: employeesMap.get('sde1@codrix.co.in').id,
        leaveTypeId: paidLeave.id,
        startDate: new Date(Date.now() + 432000000), // in 5 days
        endDate: new Date(Date.now() + 518400000),
        daysCount: 2,
        reason: 'Family event and travel',
        status: 'PENDING'
      }
    });
  }

  console.log('✅ Seeding completed successfully!');
  console.log('🏢 Tenant:', tenant.displayName, `(slug: ${tenant.slug})`);
  console.log('🔑 Credentials: Any seed email with password "Password123!"');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
