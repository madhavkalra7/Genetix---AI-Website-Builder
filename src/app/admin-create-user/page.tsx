"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  UsersIcon, 
  SearchIcon, 
  PlusIcon, 
  SettingsIcon, 
  CreditCardIcon, 
  Loader2Icon, 
  CheckIcon, 
  UserPlusIcon, 
  XIcon, 
  DatabaseIcon,
  ShieldCheckIcon
} from "lucide-react";
import { Starfield, AuroraBackground } from "@/components/animations/aurora-background";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Search filter state
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states for creating user
  const [createEmail, setCreateEmail] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createCredits, setCreateCredits] = useState(3);

  // Form states for editing credits
  const [editLimit, setEditLimit] = useState(3);
  const [editUsed, setEditUsed] = useState(0);

  // TRPC Queries
  const { data: isAdmin, isLoading: isLoadingAdmin } = useQuery(
    trpc.admin.isAdmin.queryOptions()
  );

  const { data: users, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery(
    trpc.admin.getAllUsers.queryOptions(undefined, {
      enabled: !!user && !!isAdmin
    })
  );

  const { data: creditRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery(
    trpc.admin.getCreditRequests.queryOptions(undefined, {
      enabled: !!user && !!isAdmin
    })
  );

  // TRPC Mutations
  const createUserMutation = useMutation(
    trpc.admin.createUser.mutationOptions({
      onSuccess: () => {
        toast.success("User created successfully!");
        refetchUsers();
        setIsCreateOpen(false);
        // Clear fields
        setCreateEmail("");
        setCreateFirstName("");
        setCreateLastName("");
        setCreatePassword("");
        setCreateCredits(3);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to create user");
      }
    })
  );

  const updateCreditsMutation = useMutation(
    trpc.admin.updateCredits.mutationOptions({
      onSuccess: () => {
        toast.success("Credits updated successfully!");
        refetchUsers();
        setIsEditOpen(false);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to update credits");
      }
    })
  );

  const approveRequestMutation = useMutation(
    trpc.admin.approveRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Credit request approved and plan active!");
        refetchRequests();
        refetchUsers();
      },
      onError: (err) => {
        toast.error(err.message || "Approval failed");
      }
    })
  );

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createFirstName || !createLastName || !createPassword) {
      toast.error("Please fill in all user details");
      return;
    }
    createUserMutation.mutate({
      email: createEmail,
      firstName: createFirstName,
      lastName: createLastName,
      password: createPassword,
      creditsLimit: createCredits
    });
  };

  const handleUpdateCredits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    updateCreditsMutation.mutate({
      userId: selectedUser.id,
      creditsLimit: editLimit,
      creditsUsed: editUsed
    });
  };

  const handleEditClick = (usr: any) => {
    setSelectedUser(usr);
    setEditLimit(usr.creditsLimit);
    setEditUsed(usr.creditsUsed);
    setIsEditOpen(true);
  };

  // Filter users list based on search term
  const filteredUsers = users?.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Security gate checks
  if (loading || isLoadingAdmin) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white gap-4 font-sans select-none z-50">
        <Loader2Icon className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-xs text-white/50 uppercase tracking-widest font-[Orbitron]">Checking Credentials...</p>
      </div>
    );
  }

  // Admin credentials checks
  if (!user || !isAdmin) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center text-white p-6 text-center gap-4 font-sans z-50">
        <Starfield count={50} />
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-3xl font-bold animate-pulse mb-2">🔒</div>
        <h1 className="text-2xl font-bold font-[Orbitron] text-red-400">Admin Access Required</h1>
        <p className="text-xs text-white/50 max-w-sm leading-relaxed font-[Orbitron]">
          This folder requires specific permissions. If you are authorized, please login using your administrator account.
        </p>
        <Button 
          onClick={() => router.push("/sign-in")} 
          className="bg-purple-600 hover:bg-purple-700 text-white font-[Orbitron] rounded-xl px-6 cursor-pointer"
        >
          Go to Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full text-white overflow-x-hidden pt-24 pb-12 px-6 md:px-12 font-sans">
      {/* Background system */}
      <div className="absolute inset-0 bg-black -z-20" />
      <div className="absolute inset-0 -z-10 opacity-70">
        <Starfield count={80} />
        <AuroraBackground />
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Console */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-white/10 font-[Orbitron]">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Admin Console
              </h1>
            </div>
            <p className="text-xs text-white/55 mt-1 font-sans">
              Manage database records, configure user limits, and approve pending credit packages.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl px-5 h-11 flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-400/30"
          >
            <UserPlusIcon className="w-4 h-4" />
            Create User
          </Button>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left / Center Panels: User list table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-lg font-bold font-[Orbitron] text-white flex items-center gap-2">
                  <UsersIcon className="w-5 h-5 text-purple-400" />
                  User Catalog
                </h2>
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full h-10 pl-9 pr-4 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-[Orbitron] focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* Users Catalog Table */}
              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-black/20">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-white/50 uppercase tracking-wider font-[Orbitron] text-[10px]">
                      <th className="p-4">User Details</th>
                      <th className="p-4">Active Plan</th>
                      <th className="p-4">Used / Total Credits</th>
                      <th className="p-4 text-center">Configure</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-white/40">
                          <Loader2Icon className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                          Fetching active users...
                        </td>
                      </tr>
                    ) : filteredUsers && filteredUsers.length > 0 ? (
                      filteredUsers.map((usr) => (
                        <tr key={usr.id} className="border-b border-white/5 hover:bg-white/5 transition-colors duration-200">
                          <td className="p-4">
                            <div className="font-semibold text-white">{usr.firstName} {usr.lastName}</div>
                            <div className="text-white/40 text-[10px]">{usr.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-[Orbitron] ${
                              usr.planName === "pro" 
                                ? "bg-purple-500/25 text-purple-300 border border-purple-500/30" 
                                : usr.planName === "enterprise"
                                ? "bg-pink-500/25 text-pink-300 border border-pink-500/30"
                                : "bg-white/5 text-white/60 border border-white/10"
                            }`}>
                              {usr.planName.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-white">
                              {usr.creditsLimit - usr.creditsUsed} / {usr.creditsLimit} <span className="text-white/40 font-normal">rem</span>
                            </div>
                            <div className="text-[10px] text-white/40">{usr.creditsUsed} used</div>
                          </td>
                          <td className="p-4 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditClick(usr)}
                              className="h-8 w-8 p-0 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                              title="Edit Credits"
                            >
                              <SettingsIcon className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-white/30">
                          No matching user logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Panel: Pending Credit Request Section */}
          <div className="space-y-6">
            <div className="p-6 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-xl shadow-2xl space-y-4">
              <h2 className="text-lg font-bold font-[Orbitron] text-white flex items-center gap-2">
                <CreditCardIcon className="w-5 h-5 text-purple-400" />
                Credit Requests
              </h2>
              
              <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                {isLoadingRequests ? (
                  <div className="text-xs text-white/40 text-center py-6">
                    <Loader2Icon className="w-4 h-4 animate-spin mx-auto mb-2 text-purple-500" />
                    Checking request queues...
                  </div>
                ) : creditRequests && creditRequests.length > 0 ? (
                  creditRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className={`p-4 border rounded-2xl flex flex-col gap-3 transition-colors ${
                        req.status === "PENDING"
                          ? "bg-purple-950/20 border-purple-500/30"
                          : "bg-white/5 border-white/5"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{req.email}</p>
                          <p className="text-[10px] text-white/40 mt-1">Requested: <span className="font-bold text-white/70 font-[Orbitron]">{req.planName.toUpperCase()}</span></p>
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          req.status === "PENDING" 
                            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" 
                            : "bg-green-500/20 text-green-400 border border-green-500/30"
                        }`}>
                          {req.status}
                        </span>
                      </div>

                      {req.status === "PENDING" && (
                        <Button
                          size="sm"
                          onClick={() => approveRequestMutation.mutate({ requestId: req.id })}
                          disabled={approveRequestMutation.isPending}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-[Orbitron] text-[10px] font-bold rounded-xl h-8 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {approveRequestMutation.isPending ? (
                            <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckIcon className="w-3.5 h-3.5" />
                          )}
                          Approve Request
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-white/30 text-center py-12">
                    <DatabaseIcon className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    No credit requests in queue.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog: Create User Form */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-neutral-950 border border-white/10 rounded-3xl text-white font-sans p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-[Orbitron] text-purple-400 flex items-center gap-2">
              <UserPlusIcon className="w-5 h-5" /> Create New User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">First Name</label>
                <input
                  type="text"
                  required
                  value={createFirstName}
                  onChange={(e) => setCreateFirstName(e.target.value)}
                  className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Last Name</label>
                <input
                  type="text"
                  required
                  value={createLastName}
                  onChange={(e) => setCreateLastName(e.target.value)}
                  className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Email Address</label>
              <input
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white font-[Orbitron]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Password</label>
              <input
                type="password"
                required
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white font-[Orbitron]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Initial Credit Limit</label>
              <input
                type="number"
                min="0"
                value={createCredits}
                onChange={(e) => setCreateCredits(parseInt(e.target.value) || 0)}
                className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white font-[Orbitron]"
              />
            </div>

            <DialogFooter className="pt-4 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="bg-white/5 hover:bg-white/10 text-white rounded-xl h-10 font-[Orbitron] text-xs cursor-pointer flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 font-bold font-[Orbitron] text-xs cursor-pointer flex-1 flex items-center justify-center gap-1.5"
              >
                {createUserMutation.isPending ? (
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserPlusIcon className="w-3.5 h-3.5" />
                )}
                Save User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog: Edit Credits Form */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-neutral-950 border border-white/10 rounded-3xl text-white font-sans p-6 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-[Orbitron] text-purple-400 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" /> Adjust User Credits
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleUpdateCredits} className="space-y-4 py-4">
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-xs mb-2">
                <span className="text-white/40 block font-[Orbitron] uppercase text-[9px] font-bold">Selected User</span>
                <span className="font-semibold text-white block mt-0.5">{selectedUser.firstName} {selectedUser.lastName}</span>
                <span className="text-white/50 text-[10px] block font-[Orbitron]">{selectedUser.email}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Credits Limit</label>
                  <input
                    type="number"
                    min="0"
                    value={editLimit}
                    onChange={(e) => setEditLimit(parseInt(e.target.value) || 0)}
                    className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white font-[Orbitron]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/40 uppercase font-bold font-[Orbitron]">Credits Used</label>
                  <input
                    type="number"
                    min="0"
                    value={editUsed}
                    onChange={(e) => setEditUsed(parseInt(e.target.value) || 0)}
                    className="w-full h-10 px-3 bg-black/50 border border-white/15 focus:border-purple-500/50 rounded-xl text-xs text-white font-[Orbitron]"
                  />
                </div>
              </div>

              <DialogFooter className="pt-4 flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-white rounded-xl h-10 font-[Orbitron] text-xs cursor-pointer flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateCreditsMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 font-bold font-[Orbitron] text-xs cursor-pointer flex-1 flex items-center justify-center gap-1.5"
                >
                  {updateCreditsMutation.isPending ? (
                    <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
