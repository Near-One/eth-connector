#![no_std]
#![feature(core_intrinsics)]
#![feature(alloc_error_handler)]
extern crate alloc;
extern crate core;

mod log_entry;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[panic_handler]
#[no_mangle]
pub unsafe fn on_panic(_info: &::core::panic::PanicInfo) -> ! {
	::core::intrinsics::abort();
}

#[alloc_error_handler]
#[no_mangle]
pub unsafe fn on_alloc_error(_: core::alloc::Layout) -> ! {
	::core::intrinsics::abort();
}
