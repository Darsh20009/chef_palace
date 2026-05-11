export default function CoffeeSteam() {
 return (
 <div className="absolute -top-6 right-1/2 transform translate-x-1/2" data-testid="animation-coffee-steam">
 <div className="flex space-x-1">
 <div 
 className="w-1 h-6 bg-primary rounded-full opacity-70 coffee-steam"
 data-testid="steam-line-1"
 />
 <div 
 className="w-1 h-8 bg-primary rounded-full opacity-80 coffee-steam" 
 style={{ animationDelay: '0.2s' }}
 data-testid="steam-line-2"
 />
 <div 
 className="w-1 h-6 bg-primary rounded-full opacity-70 coffee-steam" 
 style={{ animationDelay: '0.4s' }}
 data-testid="steam-line-3"
 />
 </div>
 </div>
 );
}
