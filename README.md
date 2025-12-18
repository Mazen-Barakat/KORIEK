# 🚗 KORIEK - Car Service Management Platform

<div align="center">

[![Live Demo](https://img.shields.io/badge/🌐-Live%20Demo-blue?style=for-the-badge)](https://koriek.vercel.app/select-role)
[![.NET](https://img.shields.io/badge/.NET-9.0-512BD4?style=for-the-badge&logo=dotnet)](https://dotnet.microsoft.com/)
[![Angular](https://img.shields.io/badge/Angular-20.3-DD0031?style=for-the-badge&logo=angular)](https://angular.io/)
[![SQL Server](https://img.shields.io/badge/SQL%20Server-2022-CC2927?style=for-the-badge&logo=microsoft-sql-server)](https://www.microsoft.com/sql-server)

**A comprehensive platform connecting car owners with workshops for seamless vehicle maintenance and service management**

[Features](#-features) • [Architecture](#-system-architecture) • [Tech Stack](#-tech-stack) • [Backend Repository](https://github.com/Mazen-Barakat/Korik) 
 

</div>

---

📽️ Project Demo (Video)

https://github.com/user-attachments/assets/4fe93a65-2b3f-4b51-8948-385f9b9ddbfa

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Database Design](#-database-design)
- [Tech Stack](#-tech-stack)
- [Contributing](#-contributing)
- [Contact](#-contact)


---

## 🌟 Overview

**KORIEK** is a full-stack web application that revolutionizes the car service industry by providing a unified platform where:

- 🚙 **Car Owners** can manage their vehicles, track maintenance history, book services, and receive AI-powered recommendations
- 🔧 **Workshop Owners** can manage their services, appointments, and communicate with customers in real-time
- 💳 **Seamless Payments** via Stripe integration with automatic commission handling
- 📊 **Comprehensive Analytics** for tracking expenses, service history, and workshop performance
- 🤖 **AI Assistant** powered by OpenAI GPT-4 for vehicle maintenance advice

---

## ✨ Features

### For Car Owners 🚙

- **Vehicle Management**
  - Add multiple vehicles with detailed specifications
  - Track mileage, engine capacity, and vehicle indicators
  - Upload vehicle images and documentation
  - Comprehensive expense tracking and analytics
  
- **Service Booking**
  - Browse and discover local workshops
  - View workshop profiles, services, and reviews
  - Book appointments with real-time availability
  - Track booking status through the entire workflow
  
- **Payment System**
  - Secure credit card payments via Stripe
  - Wallet balance for quick transactions
  - Automatic payment triggers when service is ready
  - Transparent commission breakdown (12% platform fee)
  
- **Communication**
  - Real-time notifications via SignalR
  - In-app messaging with workshops
  - Email confirmations and updates
  
- **AI Assistant**
  - Chat with GPT-4 powered AI for maintenance advice
  - Get recommendations based on vehicle history
  - Troubleshooting assistance

### For Workshop Owners 🔧

- **Workshop Management**
  - Complete profile customization
  - Add multiple workshop photos
  - Define working hours and availability
  - Service catalog management
  
- **Booking Management**
  - Real-time booking dashboard
  - Status workflow: Pending → Confirmed → InProgress → ReadyForPickup → Completed
  - Upload service photos and documentation
  - Customer communication hub
  
- **Analytics & Reporting**
  - Revenue tracking and commission reports
  - Performance metrics
  - Customer reviews and ratings
  
- **Service Catalog**
  - Create custom services with pricing
  - Category and subcategory organization
  - Service descriptions and specifications

### Platform Features 🎯

- **Multi-Role Authentication**
  - JWT-based authentication
  - Google OAuth integration
  - Role-based access control (Car Owner, Workshop Owner, Admin)
  - Email confirmation and password reset
  
- **Real-time Communication**
  - SignalR hubs for instant notifications
  - Live booking status updates
  - In-app messaging
  
- **Responsive Design**
  - Mobile-first approach
  - Angular Material UI components
  - Beautiful animations and transitions
  
- **Background Processing**
  - Appointment confirmation reminders
  - Automated email notifications
  - Webhook processing for Stripe events

---

## 🏗 System Architecture

### Clean Architecture Implementation

The backend follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────┐
│                    Korik.API (Web)                      │
│  • Controllers • Middleware • SignalR Hubs              │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│              Korik.Application (Business Logic)         │
│  • Services • DTOs • Validators • MediatR Handlers      │
│  • AutoMapper Profiles • Interfaces                     │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│                Korik.Domain (Entities)                  │
│  • Domain Models • Enums • Base Entities                │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│          Korik.Infrastructure (Data & External)         │
│  • EF Core DbContext • Repositories                     │
│  • External Services (Stripe, Email, Google Auth)       │
│  • Background Services • Database Migrations            │
└─────────────────────────────────────────────────────────┘
```

### Backend Architecture Diagram
<img width="3971" height="5803" alt="diagram-export-12-11-2025-5_53_20-PM" src="https://github.com/user-attachments/assets/e9fda49c-8ffb-4ce1-bbae-fcf9511ecf1c" />

The system architecture includes:

- **API Layer**: RESTful endpoints with JWT authentication
- **Application Layer**: Business logic, validation, and service orchestration
- **Domain Layer**: Core business entities and rules
- **Infrastructure Layer**: Data access, external integrations, and cross-cutting concerns

---

## 🗄 Database Design

### Entity Relationship Diagram (ERD)
<img width="1137" height="662" alt="Capture" src="https://github.com/user-attachments/assets/755910e5-1b15-4ff7-bceb-a9ded534b19a" />


### Core Database Tables

## 🛠 Tech Stack

### Backend (.NET 9)

| Technology | Purpose | Version |
|------------|---------|---------|
| **ASP.NET Core** | Web API Framework | 9.0 |
| **Entity Framework Core** | ORM & Database Access | 9.0 |
| **MediatR** | CQRS Pattern Implementation | Latest |
| **AutoMapper** | Object-Object Mapping | Latest |
| **FluentValidation** | Input Validation | Latest |
| **JWT Bearer** | Authentication | Latest |
| **SignalR** | Real-time Communication | 9.0 |
| **Stripe.net** | Payment Processing | Latest |
| **FluentEmail** | Email Service | Latest |
| **OpenAI** | AI Chat Integration | Latest |
| **SQL Server** | Database | 2022 |

### Frontend (Angular 20.3)

| Technology | Purpose | Version |
|------------|---------|---------|
| **Angular** | Frontend Framework | 20.3.0 |
| **Angular Material** | UI Component Library | 20.2.14 |
| **TypeScript** | Programming Language | Latest |
| **RxJS** | Reactive Programming | 7.8.0 |
| **SignalR Client** | WebSocket Client | 10.0.0 |
| **Stripe.js** | Payment UI | 8.5.3 |
| **Chart.js** | Data Visualization | 4.4.1 |
| **Leaflet** | Maps Integration | 1.9.4 |
| **Lottie** | Animations | 0.56.0 |

### Development Tools

- **Visual Studio 2022** - Backend Development
- **VS Code** - Frontend Development
- **SQL Server Management Studio** - Database Management
- **Postman** - API Testing
- **Git** - Version Control
- **Stripe CLI** - Webhook Testing


### Project Links

- 🌐 **Live Demo**: [[https://koriek.vercel.app/select-role](https://koriek.vercel.app/select-role)]
- 📦 **FrontEnd**: [https://github.com/Mazen-Barakat/KORIEK](https://github.com/Mazen-Barakat/KORIEK)
