# CodeAlpha Full Stack Development Tasks

This repository contains my completed projects for the **CodeAlpha Full Stack Development Internship** in the Full Stack Development domain.

## Completed Tasks

| Task | Project | Live Demo |
| --- | --- | --- |
| Task 3 | TaskFlow – Real-Time Collaborative Project Management | [Open TaskFlow](https://taskflow-373b.onrender.com/) |
| Task 4 | MeetSphere – Secure Real-Time Video Collaboration | [Open MeetSphere](https://meetsphere-wgr3.onrender.com/) |

---

## Task 3: TaskFlow

### Real-Time Collaborative Project Management

TaskFlow is a full-stack project management application inspired by tools such as Trello and Asana. It enables teams to create projects, manage Kanban boards, assign tasks, communicate through comments, and receive real-time updates.

### Features

- User registration and login
- JWT-based authentication
- Secure password hashing using bcrypt
- Group project creation and member invitations
- Kanban board with drag-and-drop task management
- Task assignment and priority management
- Due dates and overdue task highlighting
- Task descriptions, labels, and checklists
- Threaded comments inside tasks
- Real-time updates using Socket.io
- Notifications for assignments, comments, and invitations
- Project dashboard with progress statistics
- Calendar view
- Search and filtering
- CSV export
- Light and dark theme support
- Responsive user interface

### Technology Stack

- **Frontend:** HTML, CSS, and Vanilla JavaScript
- **Backend:** Node.js, Express.js, and Socket.io
- **Database:** MongoDB and Mongoose
- **Security:** JWT, bcrypt, Helmet, CORS, and rate limiting

### Live Demo and Documentation

- **Live Demo:** [Open TaskFlow](https://taskflow-373b.onrender.com/)
- **Project:** [Open TaskFlow Project](./codeAlpha_Project_Management_Tool/)
- **Documentation:** [Read TaskFlow Documentation](./codeAlpha_Project_Management_Tool/README.md)

### Run TaskFlow Locally

```bash
cd codeAlpha_Project_Management_Tool
npm install
npm start
```

Create a `.env` file using `.env.example` and configure the required variables:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
```

The application normally runs at:

```text
http://localhost:4000
```

---

## Task 4: MeetSphere

### Secure Real-Time Video Collaboration

MeetSphere is a browser-based video conferencing and collaboration application. It supports multi-user video calls, screen sharing, encrypted chat and file sharing, and a live collaborative whiteboard.

### Features

- Multi-user video and audio calls using WebRTC
- Screen sharing
- Microphone and camera controls
- Speaking indicators and participant status
- Collaborative whiteboard
- Drawing tools, eraser, colours, and brush-size controls
- Whiteboard history for late participants
- End-to-end encrypted chat
- Encrypted file sharing
- JWT-based user authentication
- Shareable room invitation links
- Emoji reactions
- Raise-hand functionality
- Participant pinning and spotlight controls
- Meeting timer and people panel

### Security and Encryption

- WebRTC media is protected using DTLS-SRTP
- Chat messages and files use AES-256-GCM encryption
- Encryption keys are derived using PBKDF2-SHA256
- Passwords are protected using bcrypt
- Production communication uses HTTPS and WSS
- Socket connections are authenticated using JWT
- Room-scoped access control is implemented
- Upload limits and security headers are configured

### Technology Stack

- WebRTC
- Socket.io
- Node.js and Express.js
- MongoDB and Mongoose
- Web Crypto API
- Canvas API
- Vanilla JavaScript
- HTML and CSS

### Live Demo and Documentation

- **Live Demo:** [Open MeetSphere](https://meetsphere-wgr3.onrender.com/)
- **Project:** [Open MeetSphere Project](./codeAlpha_Real_Time_Communication_App/)
- **Documentation:** [Read MeetSphere Documentation](./codeAlpha_Real_Time_Communication_App/README.md)

### Run MeetSphere Locally

```bash
cd codeAlpha_Real_Time_Communication_App
npm install
npm start
```

The application normally runs at:

```text
http://localhost:5000
```

For camera access, screen sharing, and production WebRTC functionality, HTTPS is recommended.

### Deployment

MeetSphere is deployed using Render:

[https://meetsphere-wgr3.onrender.com/](https://meetsphere-wgr3.onrender.com/)

MongoDB Atlas is used for cloud database hosting.

---

## Repository Structure

```text
codealpha_tasks/
├── README.md
├── codeAlpha_Project_Management_Tool/
│   ├── README.md
│   ├── package.json
│   ├── public/
│   ├── server/
│   └── ...
└── codeAlpha_Real_Time_Communication_App/
    ├── README.md
    ├── package.json
    ├── public/
    ├── server/
    └── ...
```

Each project folder contains its own source code, configuration files, and detailed documentation.

## Security Notes

- Do not upload `.env` files to GitHub.
- Do not expose passwords, API keys, database credentials, or private tokens.
- Use `.env.example` as a configuration template.
- Use a strong and unique `JWT_SECRET` in production.
- Configure MongoDB access securely for production deployments.

## Learning Outcomes

Through these projects, I gained practical experience in:

- Full-stack web application development
- REST API development
- MongoDB database integration
- Authentication and authorization
- Real-time communication using Socket.io
- Peer-to-peer communication using WebRTC
- End-to-end encryption using the Web Crypto API
- Responsive frontend development
- Application security
- Cloud deployment using Render and MongoDB Atlas

## Author

**Jaswanth Konda**

Completed as part of the CodeAlpha Full Stack Development Internship.
