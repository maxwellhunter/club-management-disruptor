import SwiftUI

// MARK: - Personal Information Settings

struct PersonalInfoView: View {
    @Environment(AuthViewModel.self) private var auth
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var phone = ""
    @State private var memberNumber = ""
    @State private var tierName = ""
    @State private var joinDate = ""
    @State private var memberId: String?

    @State private var isLoading = true
    @State private var isSaving = false
    @State private var showSavedAlert = false
    @State private var errorMessage: String?

    // Track original values to detect changes
    @State private var originalFirstName = ""
    @State private var originalLastName = ""
    @State private var originalPhone = ""

    private var hasChanges: Bool {
        firstName != originalFirstName ||
        lastName != originalLastName ||
        phone != originalPhone
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 20) {
                if isLoading {
                    ProgressView()
                        .tint(Color.club.primary)
                        .padding(.top, 60)
                } else {
                    avatarSection
                    editableFields
                    readOnlyFields
                    saveButton
                    Spacer(minLength: 32)
                }
            }
            .padding(.top, 16)
        }
        .background(Color.club.background)
        .navigationTitle("Personal Info")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfile() }
        .alert("Saved", isPresented: $showSavedAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Your personal information has been updated.")
        }
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        VStack(spacing: 12) {
            if let url = UserDefaults.standard.string(forKey: "clubos_cache_avatar_url"),
               let imageUrl = URL(string: url) {
                CachedAsyncImage(url: imageUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 88, height: 88)
                            .clipShape(Circle())
                            .contentShape(Circle())
                    default:
                        personalInfoInitials
                    }
                }
            } else {
                personalInfoInitials
            }

            Text("\(firstName) \(lastName)")
                .font(.custom("Georgia", size: 20).weight(.bold))
                .foregroundStyle(Color.club.foreground)
        }
        .padding(.bottom, 8)
    }

    private var personalInfoInitials: some View {
        Circle()
            .fill(Color.club.surfaceContainerHigh)
            .frame(width: 88, height: 88)
            .overlay {
                Text(initials)
                    .font(.system(size: 32, weight: .bold))
                    .foregroundStyle(Color.club.onSurfaceVariant)
            }
            .overlay(Circle().stroke(Color.club.outlineVariant, lineWidth: 3))
    }

    // MARK: - Editable Fields

    private var editableFields: some View {
        VStack(spacing: 0) {
            sectionHeader("EDITABLE")

            VStack(spacing: 0) {
                fieldRow(label: "First Name", icon: "person") {
                    TextField("First name", text: $firstName)
                        .textContentType(.givenName)
                }
                fieldDivider
                fieldRow(label: "Last Name", icon: "person") {
                    TextField("Last name", text: $lastName)
                        .textContentType(.familyName)
                }
                fieldDivider
                fieldRow(label: "Phone", icon: "phone") {
                    TextField("Phone number", text: $phone)
                        .textContentType(.telephoneNumber)
                        .keyboardType(.phonePad)
                }
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)
        }
    }

    // MARK: - Read-Only Fields

    private var readOnlyFields: some View {
        VStack(spacing: 0) {
            sectionHeader("ACCOUNT DETAILS")

            VStack(spacing: 0) {
                readOnlyRow(label: "Email", value: email, icon: "envelope")
                fieldDivider
                readOnlyRow(label: "Member #", value: memberNumber.isEmpty ? "—" : "#\(memberNumber)", icon: "number")
                fieldDivider
                readOnlyRow(label: "Membership", value: tierName.isEmpty ? "—" : tierName, icon: "star")
                fieldDivider
                readOnlyRow(label: "Member Since", value: joinDate.isEmpty ? "—" : joinDate, icon: "calendar")
            }
            .background(Color.club.surfaceContainerLowest, in: RoundedRectangle(cornerRadius: 16))
            .shadow(color: Color.club.foreground.opacity(0.03), radius: 12, y: 4)
            .padding(.horizontal, 20)

            Text("Contact an administrator to update your email or membership details.")
                .font(.system(size: 12))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .padding(.horizontal, 24)
                .padding(.top, 8)
        }
    }

    // MARK: - Save Button

    private var saveButton: some View {
        VStack(spacing: 8) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.system(size: 13))
                    .foregroundStyle(.red)
                    .padding(.horizontal, 20)
            }

            Button {
                Task { await saveProfile() }
            } label: {
                Group {
                    if isSaving {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Save Changes")
                            .font(.system(size: 15, weight: .semibold))
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    hasChanges ? Color.club.primary : Color.club.outlineVariant,
                    in: RoundedRectangle(cornerRadius: 14)
                )
            }
            .disabled(!hasChanges || isSaving)
            .padding(.horizontal, 20)
            .padding(.top, 8)
        }
    }

    // MARK: - Reusable Row Components

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .tracking(1)
            .foregroundStyle(Color.club.outline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.bottom, 8)
    }

    private func fieldRow<Content: View>(label: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.outline)
                content()
                    .font(.system(size: 15))
                    .foregroundStyle(Color.club.foreground)
            }

            Spacer()
        }
        .padding(16)
    }

    private func readOnlyRow(label: String, value: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15))
                .foregroundStyle(Color.club.onSurfaceVariant)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(Color.club.outline)
                Text(value)
                    .font(.system(size: 15))
                    .foregroundStyle(Color.club.foreground)
            }

            Spacer()

            Image(systemName: "lock.fill")
                .font(.system(size: 11))
                .foregroundStyle(Color.club.outlineVariant)
        }
        .padding(16)
    }

    private var fieldDivider: some View {
        Rectangle()
            .fill(Color.club.surfaceContainerLow)
            .frame(height: 1)
            .padding(.horizontal, 16)
    }

    // MARK: - Helpers

    private var initials: String {
        let f = firstName.prefix(1).uppercased()
        let l = lastName.prefix(1).uppercased()
        return "\(f)\(l)"
    }

    // MARK: - Data

    private func loadProfile() async {
        isLoading = true
        defer { isLoading = false }

        guard let userId = auth.user?.id else { return }

        // Get current member's own profile via member lookup
        struct MemberProfile: Decodable {
            let id: String
            let firstName: String
            let lastName: String
            let email: String?
            let phone: String?
            let memberNumber: String?
            let joinDate: String?
            let tierName: String?
            let role: String?
        }

        struct MembersResponse: Decodable {
            let members: [MemberProfile]
        }

        do {
            let response: MembersResponse = try await APIClient.shared.get("/members")
            // Find ourselves in the list by email
            let userEmail = auth.user?.email
            if let me = response.members.first(where: { $0.email == userEmail }) {
                memberId = me.id
                firstName = me.firstName
                lastName = me.lastName
                email = me.email ?? ""
                phone = me.phone ?? ""
                memberNumber = me.memberNumber ?? ""
                tierName = me.tierName ?? ""
                if let jd = me.joinDate {
                    joinDate = formatDate(jd)
                }
                originalFirstName = firstName
                originalLastName = lastName
                originalPhone = phone
            }
        } catch {
            errorMessage = "Failed to load profile"
        }
    }

    private func saveProfile() async {
        guard let memberId else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        struct UpdateBody: Encodable {
            let firstName: String
            let lastName: String
            let phone: String?
        }

        do {
            try await APIClient.shared.patch(
                "/members/\(memberId)",
                body: UpdateBody(
                    firstName: firstName,
                    lastName: lastName,
                    phone: phone.isEmpty ? nil : phone
                )
            )
            originalFirstName = firstName
            originalLastName = lastName
            originalPhone = phone
            showSavedAlert = true
        } catch {
            errorMessage = "Failed to save. Please try again."
        }
    }

    private func formatDate(_ dateStr: String) -> String {
        // Try ISO8601 first, then plain date
        let formatters: [DateFormatter] = {
            let iso = DateFormatter()
            iso.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
            let plain = DateFormatter()
            plain.dateFormat = "yyyy-MM-dd"
            return [iso, plain]
        }()

        for formatter in formatters {
            if let date = formatter.date(from: dateStr) {
                let display = DateFormatter()
                display.dateFormat = "MMMM d, yyyy"
                return display.string(from: date)
            }
        }
        return dateStr
    }
}
