import SwiftUI
import UserNotifications

// MARK: - Notification Preferences

struct NotificationsView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var preferences: [NotificationPref] = []
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var memberId: String?
    @State private var pushPermission: UNAuthorizationStatus = .notDetermined
    @State private var showSettingsAlert = false

    // Default categories with display info
    private static let categories: [(key: String, label: String, icon: String, description: String)] = [
        ("announcements", "Announcements", "megaphone.fill", "Club news, updates, and alerts"),
        ("bookings", "Bookings", "calendar.badge.clock", "Tee time confirmations and reminders"),
        ("billing", "Billing", "creditcard.fill", "Invoices, payments, and statements"),
        ("events", "Events", "party.popper.fill", "Event invitations, RSVPs, and updates"),
        ("guests", "Guests", "person.2.fill", "Guest visit approvals and notifications"),
    ]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                if isLoading {
                    ProgressView()
                        .tint(Color.club.primary)
                        .padding(.top, 60)
                } else {
                    headerSection
                    pushPermissionBanner
                    pushSection
                    emailSection
                    footerNote
                    Spacer(minLength: 32)
                }
            }
            .padding(.top, 16)
        }
        .background(Color.club.background)
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await checkPushPermission()
            await loadPreferences()
        }
        .alert("Push Notifications Disabled", isPresented: $showSettingsAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enable push notifications in Settings to receive alerts from ClubOS.")
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 6) {
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.club.primary)
                .frame(width: 64, height: 64)
                .background(Color.club.accent, in: RoundedRectangle(cornerRadius: 18))

            Text("Notification Preferences")
                .font(.custom("Georgia", size: 20).weight(.bold))
                .foregroundStyle(Color.club.foreground)
                .padding(.top, 4)

            Text("Choose how you'd like to be notified for each category.")
                .font(.system(size: 13))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .padding(.bottom, 8)
    }

    // MARK: - Push Notifications Section

    private var pushSection: some View {
        VStack(spacing: 0) {
            sectionHeader("PUSH NOTIFICATIONS", icon: "iphone.radiowaves.left.and.right")

            VStack(spacing: 0) {
                ForEach(Array(Self.categories.enumerated()), id: \.element.key) { index, category in
                    if index > 0 { fieldDivider }
                    toggleRow(
                        label: category.label,
                        icon: category.icon,
                        description: category.description,
                        isOn: bindingForPush(category.key)
                    )
                }
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Email Notifications Section

    private var emailSection: some View {
        VStack(spacing: 0) {
            sectionHeader("EMAIL NOTIFICATIONS", icon: "envelope.fill")

            VStack(spacing: 0) {
                ForEach(Array(Self.categories.enumerated()), id: \.element.key) { index, category in
                    if index > 0 { fieldDivider }
                    toggleRow(
                        label: category.label,
                        icon: category.icon,
                        description: category.description,
                        isOn: bindingForEmail(category.key)
                    )
                }
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Push Permission Banner

    @ViewBuilder
    private var pushPermissionBanner: some View {
        switch pushPermission {
        case .notDetermined:
            permissionCard(
                icon: "bell.badge",
                color: Color.club.primary,
                title: "Enable Push Notifications",
                message: "Get real-time updates about bookings, events, and club announcements.",
                buttonLabel: "Enable Notifications"
            ) {
                await requestPushPermission()
            }
        case .denied:
            permissionCard(
                icon: "bell.slash.fill",
                color: Color(hex: "dc2626"),
                title: "Notifications Disabled",
                message: "Push notifications are turned off. Enable them in Settings to stay updated.",
                buttonLabel: "Open Settings"
            ) {
                showSettingsAlert = true
            }
        default:
            EmptyView()
        }
    }

    private func permissionCard(
        icon: String, color: Color, title: String, message: String,
        buttonLabel: String, action: @escaping () async -> Void
    ) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 22))
                    .foregroundStyle(color)
                    .frame(width: 40, height: 40)
                    .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.club.foreground)
                    Text(message)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.club.onSurfaceVariant)
                        .lineLimit(2)
                }
            }

            Button {
                Task { await action() }
            } label: {
                Text(buttonLabel)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(color, in: RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding(16)
        .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
        .padding(.horizontal, 20)
    }

    // MARK: - Push Permission Logic

    private func checkPushPermission() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        pushPermission = settings.authorizationStatus
    }

    private func requestPushPermission() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            await checkPushPermission()
        } catch {
            await checkPushPermission()
        }
    }

    // MARK: - Footer

    private var footerNote: some View {
        Text("Some critical notifications (e.g. security alerts) cannot be disabled.")
            .font(.system(size: 12))
            .foregroundStyle(Color.club.onSurfaceVariant)
            .padding(.horizontal, 24)
    }

    // MARK: - Components

    private func sectionHeader(_ title: String, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(Color.club.outline)
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Color.club.outline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 24)
        .padding(.bottom, 8)
    }

    private func toggleRow(label: String, icon: String, description: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Color.club.primary)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.club.foreground)
                Text(description)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.onSurfaceVariant)
                    .lineLimit(1)
            }

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(Color.club.primary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    private var fieldDivider: some View {
        Rectangle()
            .fill(Color.club.surfaceContainerLow)
            .frame(height: 1)
            .padding(.horizontal, 16)
    }

    // MARK: - Bindings

    private func bindingForPush(_ category: String) -> Binding<Bool> {
        Binding(
            get: { prefFor(category).pushEnabled },
            set: { newValue in
                updatePref(category: category, push: newValue, email: nil)
            }
        )
    }

    private func bindingForEmail(_ category: String) -> Binding<Bool> {
        Binding(
            get: { prefFor(category).emailEnabled },
            set: { newValue in
                updatePref(category: category, push: nil, email: newValue)
            }
        )
    }

    private func prefFor(_ category: String) -> NotificationPref {
        preferences.first(where: { $0.category == category })
            ?? NotificationPref(id: "", category: category, pushEnabled: true, emailEnabled: true)
    }

    // MARK: - Data

    private func loadPreferences() async {
        isLoading = true
        defer { isLoading = false }

        // Find our member ID first
        guard let userEmail = auth.user?.email else { return }

        struct MembersResponse: Decodable {
            let members: [MemberStub]
        }
        struct MemberStub: Decodable {
            let id: String
            let email: String?
        }

        do {
            let response: MembersResponse = try await APIClient.shared.get("/members")
            guard let me = response.members.first(where: { $0.email == userEmail }) else { return }
            memberId = me.id

            // Load preferences from Supabase directly
            let client = SupabaseManager.shared.client
            let result: [NotificationPref] = try await client
                .from("notification_preferences")
                .select()
                .eq("member_id", value: me.id)
                .execute()
                .value

            preferences = result

            // Ensure all categories have a row
            for cat in Self.categories {
                if !preferences.contains(where: { $0.category == cat.key }) {
                    preferences.append(NotificationPref(
                        id: UUID().uuidString,
                        category: cat.key,
                        pushEnabled: true,
                        emailEnabled: true
                    ))
                }
            }
        } catch {
            // Default all on if we can't load
            preferences = Self.categories.map {
                NotificationPref(id: UUID().uuidString, category: $0.key, pushEnabled: true, emailEnabled: true)
            }
        }
    }

    private func updatePref(category: String, push: Bool?, email: Bool?) {
        // Update local state immediately
        if let idx = preferences.firstIndex(where: { $0.category == category }) {
            if let push { preferences[idx].pushEnabled = push }
            if let email { preferences[idx].emailEnabled = email }
        }

        // Persist to Supabase
        guard let memberId else { return }
        let pref = prefFor(category)

        Task {
            let client = SupabaseManager.shared.client
            let row = NotificationPrefUpsert(
                memberId: memberId,
                category: category,
                pushEnabled: pref.pushEnabled,
                emailEnabled: pref.emailEnabled
            )
            do {
                try await client
                    .from("notification_preferences")
                    .upsert(row, onConflict: "member_id,category")
                    .execute()
            } catch {
                // Silently fail — preference will reload on next visit
            }
        }
    }
}

// MARK: - Models

private struct NotificationPref: Decodable, Identifiable {
    let id: String
    var category: String
    var pushEnabled: Bool
    var emailEnabled: Bool

    // No CodingKeys needed — APIClient uses .convertFromSnakeCase
}

private struct NotificationPrefUpsert: Encodable {
    let memberId: String
    let category: String
    let pushEnabled: Bool
    let emailEnabled: Bool

    // No CodingKeys needed — APIClient uses .convertToSnakeCase
}
