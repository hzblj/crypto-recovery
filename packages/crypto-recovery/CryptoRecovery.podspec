require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "CryptoRecovery"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/hzblj/crypto-recovery.git", :tag => "#{s.version}" }

  # The store (Swift over the Security framework's synchronizable Keychain items). No cryptography.
  s.source_files = ["ios/**/*.swift"]
  s.frameworks   = ["Security"]

  load "nitrogen/generated/ios/CryptoRecovery+autolinking.rb"
  add_nitrogen_files(s)

  install_modules_dependencies(s)
end
