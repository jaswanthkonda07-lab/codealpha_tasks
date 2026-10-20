CodeAlpha Tasks



This repository contains my completed tasks for the CodeAlpha Full Stack Development Internship.



I completed two tasks from the assigned task list:



1\.

Task 3 – Project Management Tool



2\.

Task 4 – Real-Time Communication App



Repository Information



•

Internship domain: Full Stack Development



•

Repository: codealpha\_tasks



•

Author: Jaswanth Konda



Completed Tasks



Task 3 – TaskFlow: Real-Time Collaborative Project Management



TaskFlow is a full-stack project management application inspired by tools such as Trello and Asana. It allows teams to create projects, manage Kanban boards, assign tasks, communicate through task comments, and receive real-time updates.



Main features



•

User registration and login using JWT authentication



•

Secure password hashing with bcrypt



•

Group projects and member invitations



•

Kanban board with drag-and-drop task movement



•

Task assignment, priority, due dates, descriptions, labels, and checklists



•

Task comments and real-time activity updates



•

Notifications for assignments, comments, and invitations



•

Dashboard with project progress and statistics



•

Calendar view, search, filters, CSV export, and light/dark theme



•

Real-time communication using Socket.io



Technologies



•

Frontend: HTML, CSS, Vanilla JavaScript



•

Backend: Node.js, Express.js, Socket.io



•

Database: MongoDB and Mongoose



•

Security: JWT, bcrypt, Helmet, CORS, rate limiting



Project folder



codeAlpha\_Project\_Management\_Tool/



For complete features, setup instructions, API documentation, and deployment details, see the TaskFlow README.



Local setup



Bash





cd codeAlpha\_Project\_Management\_Tool

npm install







Create a .env file from .env.example, configure MONGODB\_URI and JWT\_SECRET, and then start the application:



Bash





npm start







The application runs at the local address shown in the terminal, normally http://localhost:4000.









Task 4 – MeetSphere: Secure Real-Time Video Collaboration



MeetSphere is a browser-based video conferencing and collaboration application. It supports multi-user video calls, screen sharing, encrypted chat and file sharing, and a collaborative whiteboard.



Main features



•

Multi-user video and audio calls using WebRTC



•

Screen sharing with track replacement



•

Microphone and camera controls



•

Speaking indicators and participant status



•

Collaborative whiteboard with drawing tools



•

Whiteboard history for users joining later



•

End-to-end encrypted chat and file sharing



•

JWT-based account registration and login



•

Shareable room invitation links



•

Emoji reactions, raise-hand badges, participant pinning, and meeting timer



Security and encryption



•

WebRTC media is protected using DTLS-SRTP



•

Chat messages and files are encrypted in the browser using AES-256-GCM



•

Encryption keys are derived using PBKDF2-SHA256



•

Passwords are protected with bcrypt hashing



•

Signalling and API requests use HTTPS/WSS in production



•

JWT-authenticated sockets and room-scoped access controls are used



Technologies



•

WebRTC



•

Socket.io



•

Node.js and Express.js



•

MongoDB and Mongoose



•

Web Crypto API



•

Canvas API



•

Vanilla JavaScript and CSS



Project folder



codeAlpha\_ Real\_Time\_Communication\_App/



For complete features, setup instructions, security details, limitations, and deployment information, see the MeetSphere README.



Live demo







Open the MeetSphere live demo



Local setup



Bash





cd "codeAlpha\_ Real\_Time\_Communication\_App"

npm install







Create a .env file from .env.example, configure the required environment variables, and start the application:



Bash





npm start







The application normally runs at http://localhost:5000.





Note: Camera access, screen sharing, and some browser security features work most reliably over HTTPS. The deployed Render application provides HTTPS automatically.









Repository Structure



Plain Text





codealpha\_tasks/

├── README.md

├── codeAlpha\_Project\_Management\_Tool/

│   ├── README.md

│   ├── package.json

│   ├── public/

│   ├── server/

│   └── ...

└── codeAlpha\_ Real\_Time\_Communication\_App/

&#x20;   ├── README.md

&#x20;   ├── package.json

&#x20;   ├── public/

&#x20;   ├── server/

&#x20;   └── ...







Each project folder contains its own detailed documentation, source code, configuration files, and setup instructions.



Deployment



Both projects can be deployed using:



•

Render for hosting the Node.js applications



•

MongoDB Atlas for the production database



Refer to the individual project README files for environment variables and deployment instructions.



Important Security Notes



•

Do not commit .env files, passwords, API keys, database credentials, or private tokens.



•

Use .env.example as a template for local configuration.



•

Use a strong, unique JWT\_SECRET in production.



•

Configure production database access carefully.



Learning Outcomes



Through these projects, I gained practical experience with:



•

Full-stack web application development



•

REST API design and backend development



•

MongoDB database integration



•

Authentication and authorization



•

Real-time communication with Socket.io and WebRTC



•

Web application security



•

Responsive frontend design



•

Deployment using Render and MongoDB Atlas



Acknowledgement



Completed as part of the CodeAlpha Full Stack Development Internship.





