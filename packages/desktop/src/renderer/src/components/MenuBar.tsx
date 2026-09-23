import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type MenuItem = {
  label: string
  onSelect: () => void
}

export type Menu = {
  label: string
  items: MenuItem[]
}

type MenuBarProps = {
  menus: Menu[]
}

export function MenuBar({ menus }: MenuBarProps) {
  return (
    <div className="flex items-center gap-1">
      {menus.map((menu) => (
        <DropdownMenu key={menu.label}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold data-[state=open]:bg-accent"
              aria-haspopup="menu"
            >
              {menu.label}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {menu.items.length === 0 ? (
              <DropdownMenuItem disabled>Nothing here yet</DropdownMenuItem>
            ) : (
              menu.items.map((item) => (
                <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
                  {item.label}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </div>
  )
}
