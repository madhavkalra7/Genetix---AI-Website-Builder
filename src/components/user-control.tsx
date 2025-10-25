"use client"

import { useAuth } from "@/contexts/AuthContext";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

interface Props {
    showName?: boolean;
}

export const UserControl = ({ showName }: Props) => {
    const { user: customAuthUser, signOut: customSignOut } = useAuth();
    const { data: session } = useSession();

    // Check both custom auth and NextAuth
    const user = customAuthUser || session?.user;
    
    if (!user) return null;

    // Get display name - handle both auth types
    const displayName = customAuthUser
        ? (customAuthUser.firstName && customAuthUser.lastName
            ? `${customAuthUser.firstName} ${customAuthUser.lastName}`
            : customAuthUser.username || customAuthUser.email)
        : (session?.user?.name || session?.user?.email || 'User');

    // Get initials
    const initials = customAuthUser
        ? (customAuthUser.firstName && customAuthUser.lastName
            ? `${customAuthUser.firstName[0]}${customAuthUser.lastName[0]}`
            : customAuthUser.username?.[0]?.toUpperCase() || customAuthUser.email[0].toUpperCase())
        : (session?.user?.name
            ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
            : session?.user?.email?.[0]?.toUpperCase() || 'U');

    // Get profile image
    const profileImage = customAuthUser?.image || (session?.user as any)?.image;

    const handleSignOut = async () => {
        if (session) {
            // NextAuth logout
            await nextAuthSignOut({ callbackUrl: "/auth/signin" });
        } else {
            // Custom auth logout
            customSignOut();
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-8 px-2 rounded-md">
                    <Avatar className="h-8 w-8 rounded-md">
                        {profileImage && <AvatarImage src={profileImage} alt={displayName} />}
                        <AvatarFallback className="rounded-md bg-primary text-primary-foreground">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    {showName && (
                        <span className="text-sm font-medium">
                            {displayName}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">
                            {displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {user.email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/pricing" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        Subscription
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};